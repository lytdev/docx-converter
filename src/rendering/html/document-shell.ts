import type { ConversionOptions } from '../../contracts/conversion.js';
import { esc } from '../../shared/markup.js';
export function renderDocument(body: string, options: ConversionOptions): string {
    const fragment = `<article class="docx-document" style="font-family:serif;font-size:11pt;line-height:1.5;overflow-wrap:anywhere">${body}</article>`;
    if (options.output === 'fragment') return fragment;
    return `<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${esc(options.title ?? 'DOCX 转换文档')}</title><style>body{margin:0;padding:32px;background:#fff;color:#1e293b}.docx-document{max-width:960px;margin:auto}.docx-document table{max-width:100%}.docx-document img{max-width:100%;object-fit:contain}.docx-document figure{margin:1em 0}.docx-document figcaption{text-align:center}.docx-document math[display=block]{margin:.6em 0}.unsupported-content{color:#92400e;background:#fff7ed;border:1px dashed #d97706;padding:2px 6px}@media print{body{padding:0}}</style></head><body>${fragment}</body></html>`;
  }
