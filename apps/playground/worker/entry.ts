import { convertDocx } from '../../../src/index';
import { convertMathTypePreview } from '../../../src/browser-metafile';
import type { Resource } from '../../../src/index';
import type { ConversionRequest, ConversionResponse } from './protocol';

// The Worker-only tsconfig prevents Window overloads from hiding protocol errors.
const scope: DedicatedWorkerGlobalScope = self;
function send(response: ConversionResponse, transfer: Transferable[] = []): void {
  scope.postMessage(response, transfer);
}
scope.onmessage = async ({ data }: MessageEvent<ConversionRequest>) => {
  try {
    const convertedImages: Resource[] = [];
    const result = await convertDocx(data.bytes, {
      title: data.title,
      onProgress: event => send({ type: 'progress', event }),
      images: { convert: async image => {
        const converted = await convertMathTypePreview(image);
        if (converted) convertedImages.push({ path: `${image.path}.png`, mimeType: 'image/png', bytes: converted.bytes });
        return converted;
      } },
    });
    const transfer = [...new Set([...result.resources, ...convertedImages].map(resource => resource.bytes.buffer as ArrayBuffer))];
    send({ type: 'result', result: { ...result, convertedImages } }, transfer);
  } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
