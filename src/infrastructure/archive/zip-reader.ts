import { Unzip, UnzipInflate } from 'fflate';
import { DocxError } from '../../contracts/errors.js';
import type { ConversionLimits } from '../../contracts/conversion.js';
/** Bounded archive adapter. OPC and rendering are deliberately outside its scope. */
export function readZip(bytes: Uint8Array, limits: ConversionLimits): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  if (bytes.length > limits.inputBytes) throw new DocxError('INPUT_LIMIT', '输入文件超过大小限制');
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new DocxError('NOT_DOCX', '输入不是 DOCX ZIP 文件（不支持 .doc 或加密文件）');
  // fflate reads local entries; require an intact end record as well, so a
  // truncated stream cannot be accepted just because its first part inflated.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new DocxError('INVALID_ZIP', 'DOCX ZIP 结束记录缺失或文件被截断');
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) throw new DocxError('INVALID_ZIP', '不支持分卷 ZIP');
  if (view.getUint32(end + 16, true) + view.getUint32(end + 12, true) > end) throw new DocxError('INVALID_ZIP', 'ZIP 目录超出文件范围');
  let count = 0, total = 0, active = 0;
  const seen = new Set<string>();
  const unzip = new Unzip(file => {
    const path = file.name;
    if (++count > limits.entries) throw new DocxError('ZIP_ENTRIES', 'ZIP 条目过多');
    if (path.includes('\\') || path.startsWith('/') || path.includes('\0') || path.split('/').some(p => p === '..' || p.includes(':')))
      throw new DocxError('ZIP_PATH', `非法 ZIP 路径：${path}`);
    if (seen.has(path)) throw new DocxError('ZIP_DUPLICATE', `重复 ZIP 条目：${path}`);
    seen.add(path);
    if (file.originalSize !== undefined && file.originalSize > limits.entryBytes) throw new DocxError('ZIP_LIMIT', `ZIP 条目过大：${path}`);
    const chunks: Uint8Array[] = [];
    let size = 0;
    active++;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.length; total += chunk.length;
      if (size > limits.entryBytes || total > limits.totalBytes) {
        file.terminate(); throw new DocxError('ZIP_LIMIT', 'DOCX 实际解压体积超过限制');
      }
      chunks.push(chunk);
      if (final) {
        active--;
        if (path.endsWith('/')) return;
        const data = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) { data.set(c, offset); offset += c.length; }
        files.set(path, data);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    // Small compressed chunks bound decompressor output bursts before size checks.
    for (let i = 0; i < bytes.length; i += 4096) unzip.push(bytes.subarray(i, i + 4096), i + 4096 >= bytes.length);
    if (active !== 0) throw new Error('Incomplete archive');
  } catch (e) {
    if (e instanceof DocxError) throw e;
    throw new DocxError('INVALID_ZIP', '无法解压 DOCX：文件损坏、加密或压缩格式不支持');
  }

  return files;
}
