/** Synthetic CFB v3 with one Equation Native mini stream; contains no user document data. */
export function oleEquation(mtef: Uint8Array): Uint8Array {
  const native = new Uint8Array(28 + mtef.length);
  const nativeView = new DataView(native.buffer);
  nativeView.setUint16(0, 28, true);
  nativeView.setUint32(8, mtef.length, true);
  native.set(mtef, 28);
  const minis = Math.ceil(native.length / 64);
  if (minis > 8) throw new Error('Fixture too large');
  const bytes = new Uint8Array(5 * 512), view = new DataView(bytes.buffer);
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  view.setUint16(24, 0x3e, true);
  view.setUint16(26, 3, true);
  view.setUint16(28, 0xfffe, true);
  view.setUint16(30, 9, true);
  view.setUint16(32, 6, true);
  view.setUint32(44, 1, true); // one FAT sector
  view.setUint32(48, 1, true); // directory sector
  view.setUint32(56, 4096, true);
  view.setUint32(60, 2, true); // mini FAT sector
  view.setUint32(64, 1, true);
  view.setUint32(68, 0xfffffffe, true);
  view.setUint32(76, 0, true); // FAT sector ID
  for (let i = 1; i < 109; i++) view.setUint32(76 + i * 4, 0xffffffff, true);
  for (let i = 0; i < 128; i++) view.setUint32(512 + i * 4, i === 0 ? 0xfffffffd : i <= 3 ? 0xfffffffe : 0xffffffff, true);
  for (let i = 0; i < 128; i++) view.setUint32(1536 + i * 4, i < minis - 1 ? i + 1 : i === minis - 1 ? 0xfffffffe : 0xffffffff, true);
  const directoryEntry = (offset: number, name: string, type: number, sector: number, size: number) => {
    const encoded = new TextEncoder().encode(name); // fixture names are ASCII, stored UTF-16LE
    for (let i = 0; i < encoded.length; i++) bytes[offset + i * 2] = encoded[i];
    view.setUint16(offset + 64, (name.length + 1) * 2, true);
    bytes[offset + 66] = type;
    view.setUint32(offset + 116, sector, true);
    view.setUint32(offset + 120, size, true);
  };
  directoryEntry(1024, 'Root Entry', 5, 3, minis * 64);
  directoryEntry(1152, 'Equation Native', 2, 0, native.length);
  bytes.set(native, 2048);
  return bytes;
}

export function hex(input: string): Uint8Array {
  return Uint8Array.from(input.trim().split(/\s+/), part => parseInt(part, 16));
}
