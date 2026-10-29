import type { ImageNode, Inline, Paragraph } from '../../domain/document.js';
import { attr, descendants, NS, number } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import type { ParseContext } from './parse-context.js';
import { CHART_NS, parseChart } from './chart-parser.js';
import { GROUP_NS, parseGroupDrawing } from './group-drawing-parser.js';
export class DrawingParser {
  constructor(private readonly context: ParseContext, private readonly parseParagraphs: (parent: X) => Paragraph[]) {}
  parse(el: X, formula: boolean): Inline[] {
    const group = descendants(el, 'wgp', GROUP_NS)[0];
    if (group) {
      const extent = descendants(el, 'extent', NS.wp)[0];
      const image = parseGroupDrawing(group, number(extent?.getAttribute('cx') ?? undefined) / 9525, number(extent?.getAttribute('cy') ?? undefined) / 9525);
      if (image) { this.context.stats.images++; return [image]; }
      this.context.operations.warn('UNSUPPORTED_GROUP_DRAWING', '组合图形含暂不支持的结构，已保留可读取的文字');
      return descendants(group, 'txbxContent').flatMap(box => this.parseParagraphs(box).flatMap(p => [...p.children, { kind: 'break' as const }]));
    }
    const chart = descendants(el, 'chart', CHART_NS)[0];
    if (chart) {
      const extent = descendants(el, 'extent', NS.wp)[0];
      const image = parseChart(chart, this.context, number(extent?.getAttribute('cx') ?? undefined, 7810500) / 9525, number(extent?.getAttribute('cy') ?? undefined, 4762500) / 9525);
      if (image) return [image];
      this.context.operations.warn('UNSUPPORTED_CHART', '图表类型或缓存数据暂不支持生成图片');
      return [{ kind: 'unsupported', label: '[未支持的图表]' }];
    }
    const blips = descendants(el, 'blip', NS.a), vml = descendants(el, 'imagedata', NS.v);
    const refs = blips.length ? blips : vml;
    if (!refs.length) {
      const textboxes = descendants(el, 'txbxContent');
      if (textboxes.length) {
        this.context.operations.warn('TEXTBOX_FLOW', '文本框已按普通正文顺序展开，浮动位置未保留');
        return textboxes.flatMap(box => this.parseParagraphs(box).flatMap(p => [...p.children, { kind: 'break' as const }]));
      }
      if (descendants(el, 'OLEObject', NS.o).length) return [];
      this.context.operations.warn('UNSUPPORTED_DRAWING', '绘图形状/图表暂未完整支持，已保留占位');
      return [{ kind: 'unsupported', label: '[未支持的绘图]' }];
    }
    const extent = descendants(el, 'extent', NS.wp)[0];
    const meta = descendants(el, 'docPr', NS.wp)[0] ?? descendants(el, 'cNvPr', NS.a)[0];
    const alt = meta?.getAttribute('descr') || meta?.getAttribute('title') || meta?.getAttribute('name') || (formula ? '公式' : '图片');
    let w = number(extent?.getAttribute('cx') ?? undefined) / 9525;
    let h = number(extent?.getAttribute('cy') ?? undefined) / 9525;
    if (!w || !h) {
      const shape = descendants(el, 'shape', NS.v)[0];
      const style = shape?.getAttribute('style') ?? '';
      const size = (name: string) => {
        const match = style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([\\d.]+)(pt|px|in|cm|mm)`, 'i'));
        return match ? Number(match[1]) * ({ pt: 96 / 72, px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 }[match[2].toLowerCase()] ?? 1) : 0;
      };
      w ||= size('width'); h ||= size('height');
    }
    if (descendants(el, 'anchor', NS.wp).length) this.context.operations.warn('FLOATING_IMAGE', '浮动图片按正文顺序显示，保留图片尺寸');
    return refs.map(ref => {
      this.context.stats.images++;
      const id = attr(ref, 'embed', NS.r) ?? attr(ref, 'id', NS.r) ?? attr(ref, 'link', NS.r);
      const rel = id ? this.context.source.relationships(this.context.source.main).get(id) : undefined;
      let path: string | undefined;
      if (rel?.external) this.context.operations.warn('EXTERNAL_IMAGE', '外部引用图片未自动读取或下载');
      else if (rel) { path = this.context.source.resolve(this.context.source.main, rel.target); this.context.resources.add(path); }
      else this.context.operations.warn('MISSING_IMAGE', `缺少图片关系：${id ?? '(空)'}`);
      const image: ImageNode = { kind: 'image', path, alt, formula, width: w > 0 ? w : undefined, height: h > 0 ? h : undefined, css: {} };
      return image;
    });
  }

}
