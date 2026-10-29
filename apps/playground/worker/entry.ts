import { convertToHtml, convertToJson } from '../../../src/index';
import { convertMetafileImage } from '../../../src/browser-metafile';
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
    const result = await convertToHtml(data.bytes, {
      title: data.title,
      onProgress: event => send({ type: 'progress', event }),
      images: { convert: async image => {
        const converted = await convertMetafileImage(image);
        if (converted) convertedImages.push({ path: `${image.path}.png`, mimeType: 'image/png', bytes: converted.bytes });
        return converted;
      } },
    });
    const json = await convertToJson(data.bytes, {
      title: data.title,
      images: { convert: convertMetafileImage },
    });
    const transfer = [...new Set([...result.resources, ...convertedImages].map(resource => resource.bytes.buffer as ArrayBuffer))];
    send({ type: 'result', result: { ...result, json, convertedImages } }, transfer);
  } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
