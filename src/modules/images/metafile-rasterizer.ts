import type { ImageContext, ImageResult } from '../../contracts/conversion.js';
import { rasterMime } from './raster-codec.js';

/** Rasterize a DOCX EMF/WMF resource with emf-converter. */
export async function convertMetafileToPng(image: ImageContext): Promise<ImageResult | undefined> {
  if (!/\.(emf|wmf)$/i.test(image.path) || image.bytes.byteLength > 8 * 1024 * 1024) return;
  try {
    // Load only when a metafile is actually present in the document.
    const { convertMetafileToDataUrl } = await import('emf-converter');
    const dataUrl = await convertMetafileToDataUrl(Uint8Array.from(image.bytes).buffer, {
      dpiScale: 2,
      maxWidth: 1600,
      maxHeight: 1600,
    });
    const prefix = 'data:image/png;base64,';
    if (!dataUrl?.startsWith(prefix)) return;
    const encoded = dataUrl.slice(prefix.length);
    if (encoded.length > 16 * 1024 * 1024) return;
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    if (rasterMime(bytes) !== 'image/png') return;
    return { bytes, mimeType: 'image/png' };
  } catch {
    return;
  }
}
