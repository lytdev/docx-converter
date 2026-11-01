import { zipSync } from 'fflate';
import type { PlaygroundConversionResult } from './worker/protocol';

/** 自动下载可能被浏览器设置或内置容器拦截，因此保留链接供用户手动点击。 */
export interface SavedFile { url: string; name: string }

function download(blob: Blob, name: string): SavedFile {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  // 链接同时用于兜底手动下载，10 分钟后回收。
  setTimeout(() => URL.revokeObjectURL(url), 600_000);
  return { url, name };
}
export function downloadHtml(result: PlaygroundConversionResult, filename: string): SavedFile {
  return download(new Blob([result.html], { type: 'text/html;charset=utf-8' }), `${filename}.html`);
}
export function downloadJson(result: PlaygroundConversionResult, filename: string): SavedFile {
  return download(new Blob([JSON.stringify(result.json, null, 2)], { type: 'application/json;charset=utf-8' }), `${filename}.json`);
}
export function downloadPdf(bytes: Uint8Array, filename: string): SavedFile {
  return download(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), `${filename}.pdf`);
}
export function downloadResources(result: PlaygroundConversionResult, filename: string): SavedFile {
  const zip = zipSync(Object.fromEntries([...result.resources, ...result.convertedImages].map(resource => [resource.path, resource.bytes])));
  return download(new Blob([new Uint8Array(zip)], { type: 'application/zip' }), `${filename}-resources.zip`);
}
