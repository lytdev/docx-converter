import type { ImageContext, ImageResult } from '../../contracts/conversion.js';
import { convertMetafileToPng } from '../../modules/images/metafile-rasterizer.js';

/** Rasterize any embedded EMF or WMF image in a browser or Worker. */
export function convertMetafileImage(image: ImageContext): Promise<ImageResult | undefined> {
  return convertMetafileToPng(image);
}

/** Keep the formula-only adapter for existing callers. */
export function convertMathTypePreview(image: ImageContext): Promise<ImageResult | undefined> {
  return image.formula ? convertMetafileToPng(image) : Promise.resolve(undefined);
}
