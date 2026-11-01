import { chromium } from 'playwright-core';
import type { PdfConversionOptions } from '../../contracts/conversion.js';
import { DocxError } from '../../contracts/errors.js';

export async function renderPdf(html: string, options: PdfConversionOptions): Promise<Uint8Array> {
  const pdf = options.pdf ?? {};
  const browser = await chromium.launch(pdf.executablePath ? { executablePath: pdf.executablePath, headless: true } : { channel: 'chrome', headless: true });
  const abort = () => { void browser.close().catch(() => {}); };
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    if (options.signal?.aborted) throw new DocxError('ABORTED', '转换已取消');
    // The generated HTML's CSP blocks document scripts. Keep the browser engine
    // active so font loading and image decode promises can settle for printing.
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate('Promise.race([Promise.all([document.fonts.ready, ...Array.from(document.images).map(image => image.decode())]), new Promise((_, reject) => setTimeout(() => reject(new Error("PDF image/font load timed out")), 15000))])');
    await page.addStyleTag({ content: 'table{width:auto;max-width:100%}tr,img{break-inside:avoid}body{padding:0!important}' });
    const margin = `${pdf.margin ?? 15}mm`;
    return new Uint8Array(await page.pdf({ format: pdf.format === 'letter' ? 'Letter' : 'A4', landscape: pdf.landscape,
      margin: { top: margin, right: margin, bottom: margin, left: margin }, printBackground: true }));
  } catch (error) {
    if (options.signal?.aborted) throw new DocxError('ABORTED', '转换已取消');
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abort);
    await browser.close();
  }
}
