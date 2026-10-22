import type { ImageContext, ImageResult } from '../../contracts/conversion.js';

/** Rasterize an embedded MathType/OLE WMF or EMF preview in a browser or Worker. */
export async function convertMathTypePreview(image: ImageContext): Promise<ImageResult | undefined> {
  if (!image.formula || !/\.(wmf|emf)$/i.test(image.path)) return;
  if (!('OffscreenCanvas' in globalThis) && !('document' in globalThis)) return;
  try {
    // Load the rasterizer only for documents that actually contain a metafile preview.
    const { convertMetafileToDataUrl } = await import('emf-converter');
    const bytes = Uint8Array.from(image.bytes);
    const dataUrl = await convertMetafileToDataUrl(bytes.buffer, {
      dpiScale: 2,
      maxWidth: 1600,
      maxHeight: 1600,
    });
    const prefix = 'data:image/png;base64,';
    if (!dataUrl?.startsWith(prefix)) return;
    const encoded = dataUrl.slice(prefix.length);
    if (encoded.length > 16 * 1024 * 1024) return;
    return { bytes: Uint8Array.from(atob(encoded), character => character.charCodeAt(0)), mimeType: 'image/png' };
  } catch {
    // The core renderer retains the original WMF/EMF and reports its usual warning.
    return;
  }
}
