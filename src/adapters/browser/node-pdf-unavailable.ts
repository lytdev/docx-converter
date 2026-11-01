import { DocxError } from '../../contracts/errors.js';
export async function renderPdf(): Promise<never> {
  throw new DocxError('PDF_ENVIRONMENT', '浏览器 PDF 导出需要在主线程调用，不支持 Web Worker');
}
