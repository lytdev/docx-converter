/** Read one Equation Native stream from a bounded OLE compound file. Never activate the object. */
export function equationNativeStream(bytes: Uint8Array): Uint8Array | undefined {
  if (bytes.length < 1536 || bytes.length > 4 * 1024 * 1024) return;
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = (at: number) => view.getUint16(at, true);
    const u32 = (at: number) => view.getUint32(at, true);
    if (![0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((n, i) => bytes[i] === n)) return;
    const major = u16(26), sectorSize = 1 << u16(30), miniSize = 1 << u16(32);
    if ((major !== 3 && major !== 4) || sectorSize !== (major === 3 ? 512 : 4096) || miniSize !== 64 || u16(28) !== 0xfffe) return;
    // This size limit always fits the 109 FAT locations carried in the header.
    if (u32(72) !== 0 || u32(44) < 1 || u32(44) > 109 || u32(56) !== 4096) return;
    if (bytes.length % sectorSize !== 0) return;
    const sectorCount = bytes.length / sectorSize - 1;
    const sector = (id: number): Uint8Array => {
      if (id >= sectorCount) throw new Error('Invalid CFB sector');
      const offset = (id + 1) * sectorSize;
      return bytes.subarray(offset, offset + sectorSize);
    };
    const fat: number[] = [];
    for (let i = 0; i < u32(44); i++) {
      const id = u32(76 + 4 * i), data = sector(id);
      const table = new DataView(data.buffer, data.byteOffset, data.byteLength);
      for (let p = 0; p < sectorSize; p += 4) fat.push(table.getUint32(p, true));
    }
    const chain = (first: number, table: number[], unit: number, source: (id: number) => Uint8Array, limit: number): Uint8Array => {
      const chunks: Uint8Array[] = [], visited = new Set<number>();
      let id = first, size = 0;
      while (id !== 0xfffffffe) {
        if (id >= table.length || visited.has(id) || size + unit > limit) throw new Error('Invalid CFB chain');
        visited.add(id); chunks.push(source(id)); size += unit; id = table[id];
      }
      const output = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { output.set(chunk, offset); offset += unit; }
      return output;
    };
    const regular = (first: number, limit = 4 * 1024 * 1024) => chain(first, fat, sectorSize, sector, limit);
    const directory = regular(u32(48));
    let root: { first: number; size: number } | undefined;
    let native: { first: number; size: number } | undefined;
    for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
      const item = new DataView(directory.buffer, directory.byteOffset + offset, 128);
      const nameLength = item.getUint16(64, true), type = directory[offset + 66];
      if (nameLength < 2 || nameLength > 64 || nameLength % 2) continue;
      const name = new TextDecoder('utf-16le').decode(directory.subarray(offset, offset + nameLength - 2));
      const entry = { first: item.getUint32(116, true), size: item.getUint32(120, true) };
      if (item.getUint32(124, true) !== 0 || entry.size > 4 * 1024 * 1024) continue;
      if (type === 5 && name === 'Root Entry') root = entry;
      if (type === 2 && name === 'Equation Native') {
        if (native) return; // Ambiguous stream names are not safe to match heuristically.
        native = entry;
      }
    }
    if (!root || !native || native.size < 28) return;
    if (native.size >= 4096) {
      const stream = regular(native.first);
      return stream.length >= native.size ? stream.subarray(0, native.size) : undefined;
    }
    const miniFatBytes = u32(64) ? regular(u32(60), u32(64) * sectorSize) : new Uint8Array();
    if (miniFatBytes.length !== u32(64) * sectorSize) return;
    const miniView = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
    const miniFat = Array.from({ length: miniFatBytes.length / 4 }, (_, i) => miniView.getUint32(i * 4, true));
    const rootChain = root.size ? regular(root.first) : new Uint8Array();
    if (rootChain.length < root.size) return;
    const miniStream = rootChain.subarray(0, root.size);
    const miniSector = (id: number) => {
      const offset = id * miniSize;
      if (offset + miniSize > miniStream.length) throw new Error('Invalid mini sector');
      return miniStream.subarray(offset, offset + miniSize);
    };
    const stream = chain(native.first, miniFat, miniSize, miniSector, 4 * 1024 * 1024);
    return stream.length >= native.size ? stream.subarray(0, native.size) : undefined;
  } catch {
    return;
  }
}
