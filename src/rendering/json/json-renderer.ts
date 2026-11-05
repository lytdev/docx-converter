import type { Block, DocumentModel, Inline } from '../../domain/document.js';
import type { ConversionOptions } from '../../contracts/conversion.js';
import type { RenderContext, ResourceReader } from '../../contracts/ports.js';
import { ImageResolver } from '../../modules/images/image-resolver.js';
import { safeUrl } from '../../shared/markup.js';
import { resolveMathImageOutput } from '../math-image-source.js';

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
    for (const block of blocks) {
      this.context.checkAbort();
      if (block.kind === 'paragraph') {
        result.push({ ...block, children: await this.inlines(block.children) });
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

  private async inlines(nodes: Inline[]): Promise<Inline[]> {
    const result: Inline[] = [];
    for (const node of nodes) {
      this.context.checkAbort();
      if (node.kind === 'image') {
        const src = await this.images.resolve(node);
        result.push(src ? { ...node, src } : { ...node });
      } else if (node.kind === 'math') {
        const image = this.options.formulaOutput === 'mathml'
          ? undefined
          : await resolveMathImageOutput(node, this.context, this.options.generatedImageOutput ?? 'png');
        result.push(image ? { ...node, src: image.src } : { ...node });
      } else if (node.kind === 'link') {
        const url = safeUrl(node.url);
        if (!url && node.url) this.context.warn('UNSAFE_LINK', '已移除不安全的超链接地址');
        result.push({ ...node, url: url ?? '', children: await this.inlines(node.children) });
      } else result.push({ ...node });
    }
    return result;
  }
}
