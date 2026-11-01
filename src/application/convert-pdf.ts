import { convertToHtml } from './convert-docx.js';
import type { DocxInput, PdfConversionOptions, PdfConversionResult } from '../contracts/conversion.js';
import { DocxError } from '../contracts/errors.js';

export async function convertToPdf(input: DocxInput, options: PdfConversionOptions = {}): Promise<PdfConversionResult> {
  const pdf = options.pdf ?? {};
  if ((pdf.format !== undefined && !['a4', 'letter'].includes(pdf.format)) ||
      (pdf.margin !== undefined && (!Number.isFinite(pdf.margin) || pdf.margin < 0 || pdf.margin > 50)) ||
      (pdf.scale !== undefined && (!Number.isFinite(pdf.scale) || pdf.scale < 1 || pdf.scale > 4)))
    throw new DocxError('INVALID_PDF_OPTIONS', 'PDF format 必须为 a4/letter，margin 范围 0–50 mm，scale 范围 1–4');
  const html = await convertToHtml(input, { ...options, output: 'document', onProgress: e => {
    if (e.stage !== 'complete') options.onProgress?.(e);
  } });
  if (options.signal?.aborted) throw new DocxError('ABORTED', '转换已取消');
  const renderer = 'document' in globalThis
    ? await import('../adapters/browser/pdf-renderer.js')
    : await import('../adapters/node/pdf-renderer.js');
  const bytes = await renderer.renderPdf(html.html, options);
  if (options.signal?.aborted) throw new DocxError('ABORTED', '转换已取消');
  options.onProgress?.({ stage: 'complete' });
  return { bytes, mimeType: 'application/pdf', warnings: html.warnings, resources: html.resources, stats: html.stats };
}
