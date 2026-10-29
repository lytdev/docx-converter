import { child, descendants, NS, type X } from '../../infrastructure/xml/dom.js';
import { esc } from '../../shared/markup.js';
import type { ImageNode } from '../../domain/document.js';
import type { ParseContext } from './parse-context.js';

export const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const first = (el: X | undefined, name: string) => descendants(el, name, CHART_NS)[0];
const value = (el: X | undefined, name: string) => first(el, name)?.getAttribute('val');
function points(el: X | undefined): Map<number, string> {
  return new Map(descendants(el, 'pt', CHART_NS).map(pt => [Number(pt.getAttribute('idx')), first(pt, 'v')?.textContent ?? '']));
}

/** Render cached standard line charts. Unsupported chart families remain explicit placeholders. */
export function parseChart(ref: X, context: ParseContext, width = 820, height = 500): ImageNode | undefined {
  const id = ref.getAttributeNS(NS.r, 'id');
  const relation = id ? context.source.relationships(context.source.main).get(id) : undefined;
  if (!relation || relation.external) return;
  const path = context.source.resolve(context.source.main, relation.target);
  context.resources.add(path);
  const root = context.source.xml(path)?.documentElement;
  if (!root) return;
  const line = first(root, 'lineChart');
  const plot = first(root, 'plotArea');
  if (!line || !plot || (value(line, 'grouping') ?? 'standard') !== 'standard') return;
  if (Array.from(plot.childNodes).some(n => n.nodeType === 1 && /Chart$/.test(n.localName ?? '') && n.localName !== 'lineChart')) return;
  const series = descendants(line, 'ser', CHART_NS).map((ser, i) => ({
    name: first(child(ser, 'tx', CHART_NS), 'v')?.textContent ?? `系列 ${i + 1}`,
    values: points(child(ser, 'val', CHART_NS)), categories: points(child(ser, 'cat', CHART_NS)),
    color: descendants(child(ser, 'spPr', CHART_NS), 'srgbClr', NS.a)[0]?.getAttribute('val') ?? ['4874CB', 'EE822F', '75A34A'][i % 3],
    percent: (first(child(ser, 'val', CHART_NS), 'formatCode')?.textContent ?? '').includes('%'),
  }));
  const count = Math.max(0, ...series.flatMap(s => [...s.values.keys()].map(i => i + 1)));
  const values = series.flatMap(s => [...s.values.values()].filter(v => v.trim()).map(Number)).filter(Number.isFinite);
  if (!values.length || count < 1 || count > 200 || series.length > 12) return;
  const axis = first(root, 'valAx'), scaling = first(axis, 'scaling');
  const min = value(scaling, 'min') == null ? Math.min(0, ...values) : Number(value(scaling, 'min'));
  const max = value(scaling, 'max') == null ? Math.max(0, ...values) : Number(value(scaling, 'max'));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return;
  const stepRaw = (max - min) / 8, magnitude = 10 ** Math.floor(Math.log10(stepRaw));
  const step = Number(value(axis, 'majorUnit')) || [1, 2, 5, 10].find(n => n * magnitude >= stepRaw)! * magnitude;
  const percent = (first(axis, 'numFmt')?.getAttribute('formatCode') ?? '').includes('%');
  const format = (n: number, pct: boolean) => pct ? `${Math.round(n * 100)}%` : String(Number(n.toPrecision(5)));
  const table = !!first(root, 'dTable');
  const w = 820, h = 500, left = 195, right = 790, top = 35, bottom = h - (table ? (series.length + 1) * 28 + 25 : 65);
  const x = (i: number) => left + (i + .5) * (right - left) / count;
  const y = (n: number) => bottom - (n - min) / (max - min) * (bottom - top);
  const text = (x: number, y: number, content: string, extra = '') => `<text x="${x}" y="${y}" ${extra}>${esc(content)}</text>`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="1" y="1" width="818" height="498" fill="white" stroke="#d9d9d9"/><g font-family="SimSun,serif" font-size="16" fill="#44546a">`;
  for (let n = Math.ceil(min / step - 1e-8) * step, ticks = 0; n <= max + 1e-8 && ticks < 30; n += step, ticks++) {
    svg += `<path d="M${left} ${y(n)}H${right}" stroke="#d9d9d9"/>` + text(left - 12, y(n) + 5, format(n, percent), 'text-anchor="end"');
  }
  const title = descendants(first(axis, 'title'), 't', NS.a).map(n => n.textContent ?? '').join('');
  if (title) svg += text(80, (top + bottom) / 2, title, `text-anchor="middle" transform="rotate(-90 80 ${(top + bottom) / 2})"`);
  svg += `<defs><clipPath id="plot"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath></defs>`;
  series.forEach((s, row) => {
    const color = /^[0-9a-f]{6}$/i.test(s.color) ? `#${s.color}` : '#4874CB';
    let d = '', connected = false;
    for (let i = 0; i < count; i++) {
      const raw = s.values.get(i), n = Number(raw);
      if (raw == null || !raw.trim() || !Number.isFinite(n)) { connected = false; continue; }
      d += `${connected ? 'L' : 'M'}${x(i)} ${y(n)} `; connected = true;
    }
    svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="3.5" clip-path="url(#plot)"/>`;
    const labelY = bottom + (row + 1) * 28 + 20;
    if (table) {
      svg += `<rect x="12" y="${labelY - 20}" width="183" height="28" fill="none" stroke="#d9d9d9"/>` + text(52, labelY, s.name);
      svg += `<path d="M18 ${labelY - 5}H46" stroke="${color}" stroke-width="3.5"/>`;
      for (let i = 0; i < count; i++) {
        const raw = s.values.get(i), n = Number(raw);
        svg += text(x(i), labelY, raw != null && raw.trim() && Number.isFinite(n) ? format(n, s.percent) : '', 'text-anchor="middle"');
      }
    }
  });
  for (let i = 0; i < count; i++) {
    svg += text(x(i), bottom + 20, series[0].categories.get(i) ?? String(i + 1), 'text-anchor="middle"');
    if (table) for (let row = 0; row <= series.length; row++) svg += `<rect x="${left + i * (right-left)/count}" y="${bottom + row*28}" width="${(right-left)/count}" height="28" fill="none" stroke="#d9d9d9"/>`;
  }
  svg += '</g></svg>';
  context.stats.images++;
  return { kind: 'image', path, alt: title || '折线图', formula: false, width, height, css: {}, generatedSvg: svg };
}
