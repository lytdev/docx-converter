import { attr, child, children, descendants, NS, type X } from '../../infrastructure/xml/dom.js';
import { esc } from '../../shared/markup.js';
import type { ImageNode } from '../../domain/document.js';

export const GROUP_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup';
const SHAPE_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';
const a = (e: X | undefined, name: string) => child(e, name, NS.a);
const n = (e: X | undefined, name: string, fallback = 0) => {
  const value = e?.getAttribute(name);
  const result = value ? Number(value) : fallback;
  if (!Number.isFinite(result)) throw new Error('Invalid drawing coordinate');
  return result;
};
const px = (e: X | undefined, name: string, fallback = 0) => n(e, name, fallback) / 9525;
function paint(e: X | undefined, fallback: string): string {
  if (a(e, 'noFill')) return 'none';
  const fill = a(e, 'solidFill');
  const value = a(fill, 'srgbClr')?.getAttribute('val') ?? a(fill, 'sysClr')?.getAttribute('lastClr');
  return value && /^[a-f\d]{6}$/i.test(value) ? `#${value}` : fallback;
}

/** Conservative vector renderer for grouped Word shapes and straight connectors. */
export function parseGroupDrawing(root: X, width: number, height: number): ImageNode | undefined {
  try {
    if (!(width > 0 && height > 0) || width > 20000 || height > 20000) return;
    let count = 0;
    const labels: string[] = [];
    function render(el: X, scaleX: number, scaleY: number, depth = 0): string {
      if (++count > 500 || depth > 20) throw new Error('Drawing too complex');
      if (el.namespaceURI === GROUP_NS && ['wgp', 'grpSp'].includes(el.localName ?? '')) {
        const xf = a(child(el, 'grpSpPr', GROUP_NS), 'xfrm');
        const ext = a(xf, 'ext'), chExt = a(xf, 'chExt');
        const sx = n(ext, 'cx') / n(chExt, 'cx'), sy = n(ext, 'cy') / n(chExt, 'cy');
        if (!(sx > 0 && sy > 0) || !Number.isFinite(sx + sy) || n(xf, 'rot') || n(xf, 'flipH') || n(xf, 'flipV')) throw new Error('Unsupported group transform');
        const tx = px(a(xf, 'off'), 'x') - sx * px(a(xf, 'chOff'), 'x');
        const ty = px(a(xf, 'off'), 'y') - sy * px(a(xf, 'chOff'), 'y');
        const items = children(el).filter(c => c.localName === 'wsp' || c.localName === 'grpSp');
        if (!items.length || !Number.isFinite(scaleX * sx + scaleY * sy)) throw new Error('Invalid group');
        if (children(el).some(c => !['cNvPr', 'cNvGrpSpPr', 'grpSpPr', 'wsp', 'grpSp'].includes(c.localName ?? ''))) throw new Error('Unsupported group member');
        return `<g transform="translate(${tx} ${ty}) scale(${sx} ${sy})">${items.map(c => render(c, scaleX * sx, scaleY * sy, depth + 1)).join('')}</g>`;
      }
      if (el.namespaceURI !== SHAPE_NS || el.localName !== 'wsp') throw new Error('Unsupported shape');
      const pr = child(el, 'spPr', SHAPE_NS), xf = a(pr, 'xfrm'), geom = a(pr, 'prstGeom')?.getAttribute('prst');
      if (!['roundRect', 'rect', 'ellipse', 'straightConnector1', 'line'].includes(geom ?? '') || n(xf, 'rot')) throw new Error('Unsupported geometry');
      const x = px(a(xf, 'off'), 'x'), y = px(a(xf, 'off'), 'y');
      const w = px(a(xf, 'ext'), 'cx'), h = px(a(xf, 'ext'), 'cy');
      if (w < 0 || h < 0) throw new Error('Invalid shape size');
      const ln = a(pr, 'ln'), stroke = paint(ln, '#000000'), fill = paint(pr, '#FFFFFF');
      const lineWidth = px(ln, 'w', 12700);
      const style = `stroke="${stroke}" stroke-width="${lineWidth}" vector-effect="non-scaling-stroke"`;
      if (geom === 'straightConnector1' || geom === 'line') {
        const x1 = n(xf, 'flipH') ? w : 0, x2 = w - x1, y1 = n(xf, 'flipV') ? h : 0, y2 = h - y1;
        const arrow = (end: string, tipX: number, tipY: number, otherX: number, otherY: number) => {
          const type = a(ln, end)?.getAttribute('type');
          if (!type || type === 'none') return '';
          if (type !== 'triangle') throw new Error('Unsupported arrow');
          const angle = Math.atan2((tipY - otherY) * scaleY, (tipX - otherX) * scaleX);
          const length = Math.max(6, lineWidth * 4), half = length / 2;
          const bx = tipX - Math.cos(angle) * length / scaleX, by = tipY - Math.sin(angle) * length / scaleY;
          return `<path d="M${tipX} ${tipY}L${bx - Math.sin(angle) * half / scaleX} ${by + Math.cos(angle) * half / scaleY}L${bx + Math.sin(angle) * half / scaleX} ${by - Math.cos(angle) * half / scaleY}Z" fill="${stroke}"/>`;
        };
        return `<g transform="translate(${x} ${y})"><path d="M${x1} ${y1}L${x2} ${y2}" fill="none" ${style}/>${arrow('headEnd', x1, y1, x2, y2)}${arrow('tailEnd', x2, y2, x1, y1)}</g>`;
      }
      let shape = geom === 'ellipse' ? `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}"` : `<rect width="${w}" height="${h}" rx="${geom === 'roundRect' ? Math.min(w, h) / 6 : 0}"`;
      shape += ` fill="${fill}" ${style}/>`;
      const body = child(el, 'bodyPr', SHAPE_NS);
      const box = descendants(el, 'txbxContent')[0];
      const lines: { text: string; size: number; align: string }[] = [];
      const left = px(body, 'lIns', 91440) * scaleX, right = px(body, 'rIns', 91440) * scaleX;
      for (const p of children(box).filter(c => c.namespaceURI === NS.w && c.localName === 'p')) {
        const size = Math.min(200, Math.max(1, Number(attr(descendants(p, 'sz')[0], 'val') ?? 21) * 2 / 3));
        if (!Number.isFinite(size)) throw new Error('Invalid text size');
        const align = attr(child(child(p, 'pPr'), 'jc'), 'val') ?? 'left';
        const text = descendants(p, 't').map(t => t.textContent ?? '').join('');
        labels.push(text);
        const available = Math.max(size, w * scaleX - left - right);
        let line = '', used = 0;
        for (const char of text) {
          const advance = size * (/[\u0000-\u00ff]/.test(char) ? .5 : 1);
          if (used + advance > available && line) { lines.push({ text: line, size, align }); line = ''; used = 0; }
          line += char; used += advance;
        }
        lines.push({ text: line, size, align });
      }
      const total = lines.reduce((sum, l) => sum + l.size * 1.4, 0);
      const anchor = body?.getAttribute('anchor');
      let baseline = anchor === 'ctr' ? (h * scaleY - total) / 2 : anchor === 'b' ? h * scaleY - px(body, 'bIns', 45720) * scaleY - total : px(body, 'tIns', 45720) * scaleY;
      const text = lines.map(l => {
        baseline += l.size * 1.4;
        const center = l.align === 'center', end = l.align === 'right';
        return `<text x="${center ? w * scaleX / 2 : end ? w * scaleX - right : left}" y="${baseline - l.size * .25}" font-size="${l.size}" text-anchor="${center ? 'middle' : end ? 'end' : 'start'}">${esc(l.text)}</text>`;
      }).join('');
      return `<g transform="translate(${x} ${y})">${shape}<g transform="scale(${1 / scaleX} ${1 / scaleY})" font-family="SimSun,serif" fill="#000000">${text}</g></g>`;
    }
    const content = render(root, 1, 1);
    const generatedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 4}" height="${height + 4}" viewBox="-2 -2 ${width + 4} ${height + 4}">${content}</svg>`;
    return { kind: 'image', alt: labels.join('；') || '组合图形', formula: false, width: width + 4, height: height + 4, css: {}, generatedSvg, generatedKind: 'drawing' };
  } catch { return; }
}
