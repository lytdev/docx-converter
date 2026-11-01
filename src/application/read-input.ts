import { DocxError } from '../contracts/errors.js';
import type { DocxInput } from '../contracts/conversion.js';

export async function readInput(input: DocxInput, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
  if (typeof input === 'string') {
    let url: URL;
    try { url = new URL(input); } catch { throw new DocxError('INVALID_INPUT', '请提供完整的 HTTP(S) DOCX 地址'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new DocxError('INVALID_INPUT', '只支持不含用户名和密码的 HTTP(S) DOCX 地址');
    try {
      const response = await fetch(url.href, { signal });
      if (!response.ok) { await response.body?.cancel(); throw new DocxError('FETCH_FAILED', `文档下载失败：HTTP ${response.status}`); }
      if (Number(response.headers.get('content-length')) > maxBytes) {
        await response.body?.cancel(); throw new DocxError('INPUT_LIMIT', '输入文件超过大小限制');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new DocxError('FETCH_FAILED', '下载响应没有文件内容');
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { await reader.cancel(); throw new DocxError('INPUT_LIMIT', '输入文件超过大小限制'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return bytes;
    } catch (error) {
      if (signal?.aborted) throw new DocxError('ABORTED', '转换已取消');
      if (error instanceof DocxError) throw error;
      throw new DocxError('FETCH_FAILED', '文档下载失败，请检查网络及地址；浏览器跨域下载需要文件服务器允许 CORS');
    }
  }
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    if (input.size > maxBytes) throw new DocxError('INPUT_LIMIT', '输入文件超过大小限制');
    return new Uint8Array(await input.arrayBuffer());
  }
  throw new DocxError('INVALID_INPUT', '请传入 HTTP(S) 地址、File、Blob、ArrayBuffer 或 Uint8Array');
}
