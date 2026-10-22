import { equationNativeStream } from './ole-native-stream.js';
import { mtefLatex } from './mtef-latex.js';

/** Extract editable formula structure from one embedded OLE object. */
export function oleEquationLatex(bytes: Uint8Array | undefined): string | undefined {
  if (!bytes) return;
  const native = equationNativeStream(bytes);
  if (!native || native.length < 28) return;
  const header = new DataView(native.buffer, native.byteOffset, native.byteLength);
  const offset = header.getUint16(0, true), length = header.getUint32(8, true);
  if (offset < 28 || offset > native.length || length < 5 || length > native.length - offset) return;
  return mtefLatex(native.subarray(offset, offset + length));
}
