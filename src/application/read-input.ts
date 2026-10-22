import { DocxError } from '../contracts/errors.js';
import type { DocxInput } from '../contracts/conversion.js';

export async function readInput(input: DocxInput, maxBytes: number): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    if (input.size > maxBytes) throw new DocxError('INPUT_LIMIT', '输入文件超过大小限制');
    return new Uint8Array(await input.arrayBuffer());
  }
  throw new DocxError('INVALID_INPUT', '请传入 File、Blob、ArrayBuffer 或 Uint8Array');
}
