import { zipSync } from 'fflate';
import type { PlaygroundConversionResult } from './worker/protocol';

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function downloadHtml(result: PlaygroundConversionResult, filename: string): void {
  download(new Blob([result.html], { type: 'text/html;charset=utf-8' }), `${filename}.html`);
}
export function downloadJson(result: PlaygroundConversionResult, filename: string): void {
  download(new Blob([JSON.stringify(result.json, null, 2)], { type: 'application/json;charset=utf-8' }), `${filename}.json`);
}
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  download(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), `${filename}.pdf`);
}
export function downloadResources(result: PlaygroundConversionResult, filename: string): void {
  const zip = zipSync(Object.fromEntries([...result.resources, ...result.convertedImages].map(resource => [resource.path, resource.bytes])));
  download(new Blob([new Uint8Array(zip)], { type: 'application/zip' }), `${filename}-resources.zip`);
}
