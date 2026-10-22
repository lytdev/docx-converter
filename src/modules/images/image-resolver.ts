import type { ImageNode } from '../../domain/document.js';
import type { ConversionOptions, ImageContext } from '../../contracts/conversion.js';
import type { RenderContext, ResourceReader } from '../../contracts/ports.js';
import { safeUrl } from '../../shared/markup.js';
import { rasterMime, base64 } from './raster-codec.js';
/** Strategy boundary: recover image bytes, optionally convert, then resolve a safe URI. */
export class ImageResolver {
  constructor(private readonly resources: ResourceReader, private readonly context: RenderContext, private readonly options: ConversionOptions) {}
  async resolve(n: ImageNode): Promise<string | undefined> {
    const original = n.path ? this.resources.bytes(n.path) : undefined;
    if (!original || !n.path) { this.context.warn('MISSING_IMAGE', '图片资源不存在，已保留占位'); return undefined; }
    let bytes = original, mimeType = rasterMime(bytes);
    const context: ImageContext = { path: n.path, bytes, mimeType: this.resources.mime(n.path), alt: n.alt, formula: n.formula };
    if (!mimeType && this.options.images?.convert) {
      const converted = await this.options.images.convert(context);
      this.context.checkAbort();
      if (converted) { bytes = converted.bytes; mimeType = rasterMime(bytes); }
    }
    if (!mimeType) { this.context.warn('UNSUPPORTED_IMAGE', `图片 ${n.path} 需要格式转换适配器；已在 resources 中保留原始文件`); return undefined; }
    const src = this.options.images?.resolve ? await this.options.images.resolve({ ...context, bytes, mimeType }) : `data:${mimeType};base64,${base64(bytes)}`;
    this.context.checkAbort();
    const safe = safeUrl(src, true);
    if (!safe) { this.context.warn('UNSAFE_IMAGE_URL', '图片处理器返回了不安全的地址'); return undefined; }

    return safe;
  }
}
