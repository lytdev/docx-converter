import type { Block, Css, DocumentModel, HtmlAttributes, ImageNode, Inline, MathNode } from '../../domain/document.js';
import type { ConversionOptions } from '../../contracts/conversion.js';
import type { RenderContext, ResourceReader } from '../../contracts/ports.js';
import { ImageResolver } from '../../modules/images/image-resolver.js';
import { safeUrl } from '../../shared/markup.js';
import { resolveMathImageOutput } from '../math-image-source.js';
import type { MathImageOutput } from '../math-image-source.js';
import { cssText } from '../html/styles.js';
import { matchCaption } from '../html/caption-policy.js';

function formulaImageAttributes(node: MathNode, image: MathImageOutput): HtmlAttributes {
  const align = image.verticalAlignEx === undefined ? 'middle' : `${image.verticalAlignEx}ex`;
  const layout = node.display ? 'display:block;margin:.6em 0;' : `vertical-align:${align};`;
  return {
    src: image.src,
    alt: node.latex || '公式',
    class: `formula-item formula-image image-${node.display ? 'block' : 'inline'}`,
    'data-type': 'formula',
    ...(node.latex !== undefined ? { 'data-latex': node.latex } : {}),
    style: `max-width:100%;width:${image.widthEx}ex;height:${image.heightEx}ex;${layout}`,
  };
}

function mathmlAttributes(node: MathNode): HtmlAttributes {
  return {
    class: 'formula-item',
    'data-type': 'formula',
    ...(node.latex !== undefined ? { 'data-latex': node.latex } : {}),
  };
}

function imageCss(node: ImageNode, inline: boolean): Css {
  const css: Css = { 'max-width': '100%', ...node.css };
  if (node.width) css.width = `${Math.round(node.width * 100) / 100}px`;
  if (node.height) css.height = `${Math.round(node.height * 100) / 100}px`;
  css['object-fit'] = 'contain';
  if (node.formula || inline) css['vertical-align'] = 'middle';
  return css;
}

function imageAttributes(node: ImageNode, inline: boolean, src?: string): HtmlAttributes {
  const attributes: HtmlAttributes = {
    ...(src ? { src } : {}),
    alt: node.alt,
    class: node.formula
      ? `formula-item formula-image image-${inline ? 'inline' : 'block'}`
      : `image-item image-${inline ? 'inline' : 'block'}`,
    'data-type': node.formula ? 'formula' : 'image',
  };
  if (node.formula && node.latex) attributes['data-latex'] = node.latex;
  const style = cssText(imageCss(node, inline));
  if (style) attributes.style = style;
  return attributes;
}

function unsupportedAttributes(type: 'formula' | 'image', path?: string): HtmlAttributes {
  return {
    class: 'unsupported-content',
    'data-type': type,
    ...(path ? { 'data-resource': path } : {}),
  };
}

/** Projects the parsed document model into a JSON-safe tree with resolved display URLs. */
export class JsonRenderer {
  private readonly images: ImageResolver;

  constructor(resources: ResourceReader, private readonly context: RenderContext, private readonly options: ConversionOptions) {
    this.images = new ImageResolver(resources, context, options);
  }

  async render(model: DocumentModel): Promise<DocumentModel> {
    return { blocks: await this.blocks(model.blocks) };
  }

  private async blocks(blocks: Block[]): Promise<Block[]> {
    const result: Block[] = [];
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      this.context.checkAbort();
      if (block.kind === 'paragraph') {
        const caption = matchCaption(block, blocks[index + 1]);
        const captionImage = caption?.kind === 'figure' ? caption.image : undefined;
        result.push({ ...block, children: await this.inlines(block.children, captionImage) });
      } else {
        const rows: typeof block.rows = [];
        for (const row of block.rows) {
          const cells: typeof row.cells = [];
          for (const cell of row.cells) cells.push({ ...cell, blocks: await this.blocks(cell.blocks) });
          rows.push({ ...row, cells });
        }
        result.push({ ...block, caption: block.caption && { ...block.caption, children: await this.inlines(block.caption.children) },
          rows });
      }
    }
    return result;
  }

  private async inlines(nodes: Inline[], captionImage?: ImageNode): Promise<Inline[]> {
    const result: Inline[] = [];
    const inlineImage = nodes.some(node => node.kind === 'text' && node.text.trim() || node.kind === 'link');
    for (const node of nodes) {
      this.context.checkAbort();
      if (node.kind === 'image') {
        const image = captionImage && node.path === captionImage.path && node.formula === captionImage.formula
          ? { ...node, alt: captionImage.alt }
          : node;
        const src = await this.images.resolve(image);
        result.push({
          ...image,
          ...(src ? { src } : {}),
          attributes: src
            ? imageAttributes(image, inlineImage, src)
            : unsupportedAttributes(image.formula ? 'formula' : 'image', image.path),
        });
      } else if (node.kind === 'math') {
        const image = this.options.formulaOutput === 'mathml'
          ? undefined
          : await resolveMathImageOutput(node, this.context, this.options.generatedImageOutput ?? 'png');
        result.push({
          ...node,
          ...(image ? { src: image.src } : {}),
          attributes: image
            ? formulaImageAttributes(node, image)
            : this.options.formulaOutput === 'mathml'
              ? mathmlAttributes(node)
              : unsupportedAttributes('formula'),
        });
      } else if (node.kind === 'link') {
        const url = safeUrl(node.url);
        if (!url && node.url) this.context.warn('UNSAFE_LINK', '已移除不安全的超链接地址');
        result.push({ ...node, url: url ?? '', children: await this.inlines(node.children) });
      } else result.push({ ...node });
    }
    return result;
  }
}
