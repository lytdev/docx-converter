import type { Annotation, Block, DocumentMetadata, DocumentModel, Inline, Paragraph, Table } from '../../domain/document.js';
import type { ConversionOptions } from '../../contracts/conversion.js';
import type { RenderContext, ResourceReader } from '../../contracts/ports.js';
import { esc, safeUrl } from '../../shared/markup.js';
import { styleAttr, textCss, cjk } from './styles.js';
import { matchCaption } from './caption-policy.js';
import { renderDocument } from './document-shell.js';
import { ImageRenderer } from './image-renderer.js';
import { renderMathImage } from './math-image-renderer.js';
export class HtmlRenderer {
  private counters = new Map<string, number>();
  private readonly images: ImageRenderer;
  constructor(resources: ResourceReader, private readonly context: RenderContext, private readonly options: ConversionOptions) {
    this.images = new ImageRenderer(resources, context, options);
  }
  async render(model: DocumentModel, metadata: DocumentMetadata = {}): Promise<string> {
    const body = await this.blocks(model.blocks, false);
    return renderDocument(body, this.options, metadata);
  }
  private async blocks(blocks: Block[], inTable: boolean): Promise<string> {
    let html = '';
    for (let i = 0; i < blocks.length; i++) {
      this.context.checkAbort();
      const b = blocks[i], next = blocks[i + 1];
      if (b.kind === 'paragraph' && b.list) {
        const group: Paragraph[] = [];
        while (i < blocks.length && blocks[i].kind === 'paragraph' && (blocks[i] as Paragraph).list) group.push(blocks[i++] as Paragraph);
        i--;
        let j = 0;
        while (j < group.length) { const result = await this.list(group, j, inTable); html += result.html; j = result.next; }
        continue;
      }
      const caption = matchCaption(b, next);
      if (caption?.kind === 'table') { html += await this.table(caption.table, caption.caption); i++; continue; }
      if (caption?.kind === 'figure') {
        html += `<figure${styleAttr(caption.paragraph.style.css)}>${await this.images.render(caption.image, false)}<figcaption>${esc(caption.image.alt)}</figcaption></figure>`;
        i++; continue;
      }
      html += b.kind === 'table' ? await this.table(b, b.caption) : await this.paragraph(b, inTable);
    }
    return html;
  }
  private async list(items: Paragraph[], start: number, inTable: boolean): Promise<{ html: string; next: number }> {
    const first = items[start].list!, level = first.level;
    const type = first.format === 'bullet' ? 'ul' : 'ol';
    const styles: Record<string, string> = { lowerLetter: 'lower-alpha', upperLetter: 'upper-alpha', lowerRoman: 'lower-roman', upperRoman: 'upper-roman', none: 'none', bullet: 'disc' };
    const key = `${first.id}:${level}`;
    const counter = this.counters.get(key) ?? first.start;
    let html = `<${type}${type === 'ol' ? ` start="${counter}"` : ''} style="list-style-type:${styles[first.format] ?? 'decimal'}">`, i = start;
    while (i < items.length) {
      const item = items[i], spec = item.list!;
      if (spec.level !== level || spec.id !== first.id || spec.format !== first.format) break;
      for (const k of this.counters.keys()) if (k.startsWith(`${spec.id}:`) && Number(k.split(':').pop()) > level) this.counters.delete(k);
      html += `<li${styleAttr(item.style.css)}>${await this.inlines(item.children)}`;
      this.counters.set(key, (this.counters.get(key) ?? first.start) + 1);
      i++;
      while (i < items.length && items[i].list!.level > level) {
        const nested = await this.list(items, i, inTable); html += nested.html; i = nested.next;
      }
      html += '</li>';
    }
    return { html: html + `</${type}>`, next: i };
  }
  private async paragraph(p: Paragraph, inTable: boolean): Promise<string> {
    const outline = p.style.outline;
    const tag = !inTable && outline !== undefined && outline >= 0 && outline <= 5 ? `h${outline + 1}` : 'p';
    return `<${tag}${styleAttr(p.style.css)}>${p.children.length ? await this.inlines(p.children) : '<br>'}</${tag}>`;
  }
  private async table(t: Table, caption?: Paragraph): Promise<string> {
    let html = `<table${styleAttr(t.css)}>`;
    if (caption) html += `<caption${styleAttr(caption.style.css)}>${await this.inlines(caption.children)}</caption>`;
    html += '<tbody>';
    for (const r of t.rows) {
      html += `<tr${styleAttr(r.css)}>`;
      for (const c of r.cells) html += `<td${c.colspan > 1 ? ` colspan="${c.colspan}"` : ''}${c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : ''}${styleAttr(c.css)}>${await this.blocks(c.blocks, true)}</td>`;
      html += '</tr>';
    }
    return html + '</tbody></table>';
  }
  private async inlines(nodes: Inline[]): Promise<string> {
    let html = '', pendingStyle: string | undefined, pendingAnnotations: Annotation[] | undefined, pendingText = '';
    const flush = () => {
      if (pendingText) html += this.textSpan(pendingText, pendingStyle, pendingAnnotations);
      pendingStyle = undefined;
      pendingAnnotations = undefined;
      pendingText = '';
    };
    const inlineImage = nodes.some(n => n.kind === 'text' && n.text.trim() || n.kind === 'link');
    for (const n of nodes) {
      if (n.kind === 'text') {
        const segments: { text: string; east: boolean }[] = [];
        for (const char of n.text) {
          const east = cjk(char), last = segments[segments.length - 1];
          if (last && last.east === east) last.text += char; else segments.push({ text: char, east });
        }
        for (const segment of segments) {
          const css = textCss(n.style, segment.east);
          css['white-space'] = 'pre-wrap';
          const key = styleAttr(css);
          if (pendingStyle !== key || !sameAnnotations(pendingAnnotations, n.annotations)) flush();
          pendingStyle = key; pendingText += segment.text;
          pendingAnnotations = n.annotations;
        }
        continue;
      }
      flush();
      let rendered = '';
      if (n.kind === 'break') rendered = '<br>';
      else if (n.kind === 'anchor') rendered = `<a id="${esc(n.id)}"></a>`;
      else if (n.kind === 'unsupported') rendered = `<span class="unsupported-content">${esc(n.label)}</span>`;
      else if (n.kind === 'image') rendered = await this.images.render(n, inlineImage);
      else if (n.kind === 'footnote') rendered = `<sup data-type="footnote" data-footnote="${esc(n.text)}">${esc(n.number)}</sup>`;
      else if (n.kind === 'math') rendered = this.options.formulaOutput === 'mathml'
        ? `<span class="formula-item" data-type="formula"${n.latex !== undefined ? ` data-latex="${esc(n.latex)}"` : ''}>${n.mathml}</span>`
        : await renderMathImage(n, this.context, this.options.generatedImageOutput ?? 'png');
      else if (n.kind === 'link') {
        const url = safeUrl(n.url), content = await this.inlines(n.children);
        if (!url) { if (n.url) this.context.warn('UNSAFE_LINK', '已移除不安全的超链接地址'); rendered = content; }
        else rendered = `<a href="${esc(url)}" rel="noopener noreferrer" style="color:#0563c1;text-decoration:underline">${content}</a>`;
      }
      html += this.wrapAnnotations(rendered, n.annotations);
    }
    flush(); return html;
  }

  private wrapAnnotations(html: string, annotations?: Annotation[]): string {
    return (annotations ?? []).reduceRight((content, annotation) =>
      `<span class="annotation-item" data-type="annotation" data-annotation="${esc(annotation.text)}">${content}</span>`, html);
  }

  private textSpan(text: string, style?: string, annotations?: Annotation[]): string {
    const content = esc(text);
    const [annotation, ...nested] = annotations ?? [];
    if (!annotation) return `<span${style}>${content}</span>`;
    // Text spans have no data-type of their own. Images, formulas and other
    // typed nodes are wrapped below so their existing data-type is preserved.
    return this.wrapAnnotations(
      `<span class="annotation-item" data-type="annotation" data-annotation="${esc(annotation.text)}"${style}>${content}</span>`,
      nested,
    );
  }
}

function sameAnnotations(a?: Annotation[], b?: Annotation[]): boolean {
  if (!a?.length && !b?.length) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((annotation, index) => annotation.id === b[index].id && annotation.text === b[index].text);
}
