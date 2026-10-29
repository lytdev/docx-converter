import type { ImageNode } from '../../domain/document.js';
import type { ConversionOptions, ImageContext } from '../../contracts/conversion.js';
import type { RenderContext, ResourceReader } from '../../contracts/ports.js';
import { safeUrl } from '../../shared/markup.js';
import { rasterMime, base64 } from './raster-codec.js';
import { convertMetafileToPng } from './metafile-rasterizer.js';
const suffixes: Record<string, string[]> = {
  'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg', 'jpe'], 'image/gif': ['gif'], 'image/webp': ['webp'],
};

function uploadName(path: string, mimeType: string): { fileSuffix: string; fileName: string } {
  const name = path.split('/').pop() || 'image';
  const extension = name.match(/\.([^.]+)$/)?.[1].toLowerCase();
  const allowed = suffixes[mimeType];
  const fileSuffix = extension && allowed.includes(extension) ? extension : allowed[0];
  const fileName = extension && allowed.includes(extension) ? name : `${name.replace(/\.[^.]+$/, '') || 'image'}.${fileSuffix}`;
  return { fileSuffix, fileName };
}
/** Strategy boundary: recover image bytes, optionally convert, then resolve a safe URI. */
export class ImageResolver {
  constructor(private readonly resources: ResourceReader, private readonly context: RenderContext, private readonly options: ConversionOptions) {}
  async resolve(n: ImageNode): Promise<string | undefined> {
    if (n.generatedSvg) {
      const bytes = new TextEncoder().encode(n.generatedSvg);
      const images = this.options.images;
      let src = `data:image/svg+xml;base64,${base64(bytes)}`;
      if (!images?.processLargeImage || images.maxInlineBytes === undefined || bytes.length <= images.maxInlineBytes) return src;
      if (images?.processLargeImage && images.maxInlineBytes !== undefined && bytes.length > images.maxInlineBytes) {
        const result = await images.processLargeImage(new Blob([bytes], { type: 'image/svg+xml' }), 'svg', `${n.path?.split('/').pop()?.replace(/\.xml$/, '') || 'chart'}.svg`);
        this.context.checkAbort();
        src = result?.fileUrl;
      }
      const safe = typeof src === 'string' ? safeUrl(src, true) : undefined;
      if (!safe) this.context.warn('UNSAFE_IMAGE_URL', '图片处理器返回了不安全的地址');
      return safe;
    }
    const original = n.path ? this.resources.bytes(n.path) : undefined;
    if (!original || !n.path) { this.context.warn('MISSING_IMAGE', '图片资源不存在，已保留占位'); return undefined; }
    let bytes = original, mimeType = rasterMime(bytes);
    const context: ImageContext = { path: n.path, bytes, mimeType: this.resources.mime(n.path), alt: n.alt, formula: n.formula };
    if (!mimeType) {
      const converted = await this.options.images?.convert?.(context)
        ?? (/\.emf$/i.test(n.path) ? await convertMetafileToPng(context) : undefined);
      this.context.checkAbort();
      if (converted) { bytes = converted.bytes; mimeType = rasterMime(bytes); }
    }
    if (!mimeType) { this.context.warn('UNSUPPORTED_IMAGE', `图片 ${n.path} 无法生成可显示格式；已在 resources 中保留原始文件`); return undefined; }
    let src: string | undefined;
    const images = this.options.images;
    if (images?.processLargeImage && images.maxInlineBytes !== undefined) {
      if (bytes.byteLength > images.maxInlineBytes) {
        const { fileSuffix, fileName } = uploadName(n.path, mimeType);
        const fileBlob = new Blob([new Uint8Array(bytes)], { type: mimeType });
        const processed = await images.processLargeImage(fileBlob, fileSuffix, fileName);
        this.context.checkAbort();
        src = processed?.fileUrl;
      } else src = `data:${mimeType};base64,${base64(bytes)}`;
    } else if (images?.resolve) src = await images.resolve({ ...context, bytes, mimeType });
    else src = `data:${mimeType};base64,${base64(bytes)}`;
    this.context.checkAbort();
    const safe = typeof src === 'string' ? safeUrl(src, true) : undefined;
    if (!safe) { this.context.warn('UNSAFE_IMAGE_URL', '图片处理器返回了不安全的地址'); return undefined; }

    return safe;
  }
}
