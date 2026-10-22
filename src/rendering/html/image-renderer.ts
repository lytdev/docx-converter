import type { Css, ImageNode } from '../../domain/document.js';
import type { ConversionOptions } from '../../contracts/conversion.js';
import type { RenderContext, ResourceReader } from '../../contracts/ports.js';
import { ImageResolver } from '../../modules/images/image-resolver.js';
import { esc } from '../../shared/markup.js';
import { styleAttr } from './styles.js';
export class ImageRenderer {
  private readonly resolver: ImageResolver;
  constructor(resources: ResourceReader, context: RenderContext, options: ConversionOptions) {
    this.resolver = new ImageResolver(resources, context, options);
  }
  async render(n: ImageNode, inline: boolean): Promise<string> {
    const placeholder = () => `<span class="unsupported-content" data-type="${n.formula ? 'formula' : 'image'}"${n.path ? ` data-resource="${esc(n.path)}"` : ''}>${esc(`[${n.alt}：无可显示图片]`)}</span>`;

    const safe = await this.resolver.resolve(n);
    if (!safe) return placeholder();
    const css: Css = { 'max-width': '100%', ...n.css };
    if (n.width) css.width = `${Math.round(n.width * 100) / 100}px`;
    if (n.height) css.height = `${Math.round(n.height * 100) / 100}px`;
    css['object-fit'] = 'contain';
    if (n.formula || inline) css['vertical-align'] = 'middle';
    return `<img src="${esc(safe)}" alt="${esc(n.alt)}" class="${n.formula ? 'formula-item formula-image' : `image-item image-${inline ? 'inline' : 'block'}`}" data-type="${n.formula ? 'formula' : 'image'}"${n.formula && n.latex ? ` data-latex="${esc(n.latex)}"` : ''}${styleAttr(css)}>`;
  }
}
