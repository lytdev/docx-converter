/** A tiny generated WMF with editable text records, independent of user documents. */
export function textWmf(label = 'x+y'): Uint8Array {
  const record = (fn: number, args: number[] = []) => {
    const bytes = new Uint8Array(6 + args.length * 2), view = new DataView(bytes.buffer);
    view.setUint32(0, bytes.length / 2, true);
    view.setUint16(4, fn, true);
    args.forEach((arg, index) => view.setInt16(6 + index * 2, arg, true));
    return bytes;
  };
  const font = new Uint8Array(56), fontView = new DataView(font.buffer);
  fontView.setUint32(0, 28, true);
  fontView.setUint16(4, 0x02fb, true);
  fontView.setInt16(6, -20, true);
  fontView.setUint16(14, 400, true);
  font.set(new TextEncoder().encode('Times New Roman'), 24);

  const chars = new TextEncoder().encode(label);
  const output = new Uint8Array(12 + ((chars.length + 1) & ~1));
  const outputView = new DataView(output.buffer);
  outputView.setUint32(0, output.length / 2, true);
  outputView.setUint16(4, 0x0521, true);
  outputView.setUint16(6, chars.length, true);
  output.set(chars, 8);
  outputView.setInt16(output.length - 4, 10, true);
  outputView.setInt16(output.length - 2, 10, true);

  const records = [record(0x020b, [0, 0]), record(0x020c, [80, 200]), record(0x0102, [1]),
    font, record(0x012d, [0]), output, record(0)];
  const size = 18 + records.reduce((total, entry) => total + entry.length, 0);
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  view.setUint16(0, 1, true);
  view.setUint16(2, 9, true);
  view.setUint16(4, 0x300, true);
  view.setUint32(6, size / 2, true);
  view.setUint16(10, 1, true);
  view.setUint32(12, Math.max(28, output.length / 2), true);
  let position = 18;
  for (const entry of records) { bytes.set(entry, position); position += entry.length; }
  return bytes;
}
