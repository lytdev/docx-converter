import type { Css, ImageNode } from '../../domain/document.js';
import type { ConversionOptions } from '../../contracts/conversion.js';
import type { RenderContext, ResourceReader } from '../../contracts/ports.js';
import { ImageResolver } from '../../modules/images/image-resolver.js';
import { attrs, esc, safeUrl } from '../../shared/markup.js';
import { styleAttr } from './styles.js';
export class ImageRenderer {
  private readonly resolver: ImageResolver;
  constructor(resources: ResourceReader, private readonly context: RenderContext, options: ConversionOptions) {
    this.resolver = new ImageResolver(resources, context, options);
  }
  async render(n: ImageNode, inline: boolean): Promise<string> {
    const type = n.formula ? 'formula' : 'image';
    const placeholder = () => `<span class="unsupported-content" data-type="${type}"${n.path ? ` data-resource="${esc(n.path)}"` : ''}>${esc(`[${n.alt}：无可显示图片]`)}</span>`;

    if (n.attributes) {
      const source = n.src ?? n.attributes.src;
      const safe = source ? safeUrl(source, true) : undefined;
      if (!source && n.attributes.class === 'unsupported-content')
        return `<span${attrs(n.attributes)}>${esc(`[${n.alt}：无可显示图片]`)}</span>`;
      if (safe) return `<img${attrs({ ...n.attributes, src: safe })}>`;
      if (source) this.context.warn('UNSAFE_IMAGE_URL', 'JSON 图片地址不是安全的内嵌或 HTTP(S) 图片');
    }

    const safe = await this.resolver.resolve(n);
    if (!safe) return placeholder();
    const css: Css = { 'max-width': '100%', ...n.css };
    if (n.width) css.width = `${Math.round(n.width * 100) / 100}px`;
    if (n.height) css.height = `${Math.round(n.height * 100) / 100}px`;
    css['object-fit'] = 'contain';
    if (n.formula || inline) css['vertical-align'] = 'middle';
    const className = n.formula
      ? `formula-item formula-image image-${inline ? 'inline' : 'block'}`
      : `image-item image-${inline ? 'inline' : 'block'}`;
    return `<img src="${esc(safe)}" alt="${esc(n.alt)}" class="${className}" data-type="${type}"${n.formula && n.latex ? ` data-latex="${esc(n.latex)}"` : ''}${styleAttr(css)}>`;
  }
}
