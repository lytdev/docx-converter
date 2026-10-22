/** Detect one-sided evidence of stale OLE data from standard-font WMF digits. This is not OCR. */
export function previewConflicts(preview: Uint8Array | undefined, latex: string): boolean {
  if (!preview || !latex || preview.length > 4 * 1024 * 1024) return false;
  try {
    const bytes = preview, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const word = (at: number) => view.getUint16(at, true);
    if (bytes.length < 18) return false;
    const start = view.getUint32(0, true) === 0x9ac6cdd7 ? 22 : 0;
    if (bytes.length < start + 18 || ![1, 2].includes(word(start)) || word(start + 2) !== 9) return false;
    const end = start + view.getUint32(start + 6, true) * 2;
    if (end < start + 18 || end > bytes.length) return false;
    const objects: (number | undefined)[] = new Array(word(start + 10));
    let selectedFont = 1;
    const visible = new Set<string>();
    const standard = new Set(['times new roman', 'arial', 'calibri', 'cambria', 'cambria math', 'courier new', 'tahoma', 'verdana', 'segoe ui']);
    const collect = (offset: number, count: number) => {
      for (let i = offset; i < offset + count; i++) if (bytes[i] >= 48 && bytes[i] <= 57) visible.add(String.fromCharCode(bytes[i]));
    };
    const allocate = (kind: number) => {
      const index = objects.findIndex(value => value === undefined);
      if (index < 0) throw new Error('Invalid WMF object table');
      objects[index] = kind;
    };
    for (let pos = start + 18; pos < end;) {
      if (end - pos < 6) return false;
      const length = view.getUint32(pos, true) * 2;
      if (length < 6 || length > end - pos) return false;
      const next = pos + length, type = word(pos + 4);
      if (type === 0) {
        const digits = new Set((latex.normalize('NFKC').match(/[0-9]/g) ?? []));
        return [...visible].some(digit => !digits.has(digit));
      }
      switch (type) {
        case 0x02fb: {
          if (length < 56) return false;
          let nameEnd = pos + 24;
          while (nameEnd < pos + 56 && bytes[nameEnd] !== 0) nameEnd++;
          const name = new TextDecoder('ascii').decode(bytes.subarray(pos + 24, nameEnd)).toLowerCase();
          allocate(bytes[pos + 19] <= 1 && standard.has(name) ? 2 : 1);
          break;
        }
        case 0x02fa: case 0x02fc: case 0x00f7: case 0x01f9: case 0x0142: case 0x06ff: case 0x06fe: case 0x02fd: case 0x02f8:
          allocate(0); break;
        case 0x012d: {
          if (length < 8) return false;
          const handle = word(pos + 6), kind = objects[handle];
          if (kind === undefined) return false;
          if (kind !== 0) selectedFont = kind;
          break;
        }
        case 0x01f0:
          if (length < 8 || word(pos + 6) >= objects.length) return false;
          objects[word(pos + 6)] = undefined; break;
        case 0x001e: case 0x0127: return false;
        case 0x0a32: {
          if (length < 14) return false;
          const count = word(pos + 10), options = word(pos + 12);
          const at = pos + 14 + (options & 6 ? 8 : 0);
          if (count > 32767 || at > next || count > next - at) return false;
          if (selectedFont === 2 && !(options & ~6)) collect(at, count);
          break;
        }
        case 0x0521: {
          if (length < 12) return false;
          const count = word(pos + 6);
          if (((count + 1) & ~1) > next - pos - 12) return false;
          if (selectedFont === 2) collect(pos + 8, count);
          break;
        }
      }
      pos = next;
    }
  } catch { /* Unknown or damaged previews cannot establish a conflict. */ }
  return false;
}
