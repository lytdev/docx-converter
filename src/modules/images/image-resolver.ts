import type { ImageNode } from '../../domain/document.js';
import type { ConversionOptions, ImageContext } from '../../contracts/conversion.js';
import type { RenderContext, ResourceReader } from '../../contracts/ports.js';
import { safeUrl } from '../../shared/markup.js';
import { rasterMime, base64 } from './raster-codec.js';
import { convertMetafileToPng } from './metafile-rasterizer.js';
import { drawingToPng } from './drawing-rasterizer.js';
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
    if (n.src) {
      const safe = safeUrl(n.src, true);
      if (safe) return safe;
      this.context.warn('UNSAFE_IMAGE_URL', 'JSON 图片地址不是安全的内嵌或 HTTP(S) 图片');
      return undefined;
    }
    const base64ImageSize = this.options.imageHandler?.base64ImageSize ?? 2048;
    if (n.generatedSvg) {
      const generatedFormat = this.options.generatedImageOutput ?? 'png';
      const format = n.generatedKind === 'drawing'
        ? this.options.drawingOutput ?? generatedFormat
        : generatedFormat;
      const png = format !== 'svg';
      let bytes: Uint8Array;
      try {
        bytes = png ? await drawingToPng(n.generatedSvg, n.width ?? 0, n.height ?? 0) : new TextEncoder().encode(n.generatedSvg);
      } catch {
        this.context.warn('DRAWING_PNG_FAILED', '生成的图形或图表无法转换为 PNG；请检查 Canvas/字体环境，或设置 generatedImageOutput: svg');
        return undefined;
      }
      this.context.checkAbort();
      const mimeType = png ? 'image/png' : 'image/svg+xml', suffix = png ? 'png' : 'svg';
      const imageHandler = this.options.imageHandler;
      let src = `data:${mimeType};base64,${base64(bytes)}`;
      if (!imageHandler?.processLargeImage || bytes.length <= base64ImageSize) return src;
      if (imageHandler?.processLargeImage && bytes.length > base64ImageSize) {
        const baseName = n.path?.split('/').pop()?.replace(/\.xml$/, '') || n.generatedKind || 'image';
        const result = await imageHandler.processLargeImage(new Blob([new Uint8Array(bytes)], { type: mimeType }), suffix, `${baseName}.${suffix}`);
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
      const converted = await this.options.imageHandler?.convert?.(context)
        ?? (/\.emf$/i.test(n.path) ? await convertMetafileToPng(context) : undefined);
      this.context.checkAbort();
      if (converted) { bytes = converted.bytes; mimeType = rasterMime(bytes); }
    }
    if (!mimeType) { this.context.warn('UNSUPPORTED_IMAGE', `图片 ${n.path} 无法生成可显示格式；已在 resources 中保留原始文件`); return undefined; }
    let src: string | undefined;
    const imageHandler = this.options.imageHandler;
    if (imageHandler?.processLargeImage) {
      if (bytes.byteLength > base64ImageSize) {
        const { fileSuffix, fileName } = uploadName(n.path, mimeType);
        const fileBlob = new Blob([new Uint8Array(bytes)], { type: mimeType });
        const processed = await imageHandler.processLargeImage(fileBlob, fileSuffix, fileName);
        this.context.checkAbort();
        src = processed?.fileUrl;
      } else src = `data:${mimeType};base64,${base64(bytes)}`;
    } else if (imageHandler?.resolve) src = await imageHandler.resolve({ ...context, bytes, mimeType });
    else src = `data:${mimeType};base64,${base64(bytes)}`;
    this.context.checkAbort();
    const safe = typeof src === 'string' ? safeUrl(src, true) : undefined;
    if (!safe) { this.context.warn('UNSAFE_IMAGE_URL', '图片处理器返回了不安全的地址'); return undefined; }

    return safe;
  }
}
