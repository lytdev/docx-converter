import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { docx, p, sampleDocx, text } from '../fixtures/docx';

test('browser converts DOCX content into PDF bytes', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ path: resolve('dist/docx-html.umd.cjs') });
  const result = await page.evaluate(async bytes => {
    const api = (window as unknown as { DocxConvert: typeof import('../../src/index') }).DocxConvert;
    const pdf = await api.convertToPdf(new Uint8Array(bytes), { pdf: { scale: 1 } });
    return { bytes: Array.from(pdf.bytes), mimeType: pdf.mimeType, stats: pdf.stats };
  }, Array.from(sampleDocx()));
  expect(Buffer.from(result.bytes).subarray(0, 5).toString()).toBe('%PDF-');
  expect(result.bytes.length).toBeGreaterThan(5000);
  expect(result.mimeType).toBe('application/pdf');
  expect(result.stats.tables).toBe(1);
  await mkdir('.tmp/pdf', { recursive: true });
  await writeFile('.tmp/pdf/browser.pdf', Buffer.from(result.bytes));
});

test('browser PDF of a long document is not blank (canvas size limit)', async ({ page }) => {
  test.setTimeout(180000);
  // ~70 A4 pages: at scale 2 a single canvas would exceed Chrome's 65535 px limit and render white.
  const long = docx(Array.from({ length: 1400 }, (_, i) => p(text(`第 ${i + 1} 段：长文档 PDF 导出回归测试，验证分块渲染后每一页都有内容。`))).join(''));
  await page.goto('/');
  await page.addScriptTag({ path: resolve('dist/docx-html.umd.cjs') });
  const pages = await page.evaluate(async bytes => {
    const inked: number[] = [];
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args: unknown[]) {
      const data = this.getContext('2d')!.getImageData(0, 0, this.width, this.height).data;
      let dark = 0; for (let i = 0; i < data.length; i += 4) if (data[i] < 160) dark++;
      inked.push(dark);
      return toDataURL.apply(this, args as []);
    };
    const api = (window as unknown as { DocxConvert: typeof import('../../src/index') }).DocxConvert;
    await api.convertToPdf(new Uint8Array(bytes), {});
    return inked;
  }, Array.from(long));
  expect(pages.length).toBeGreaterThan(33);
  expect(pages.filter(dark => dark === 0)).toEqual([]);
});

test('Node exports a printable PDF through byte and file entries', async () => {
  const { convertToPdf, convertToPdfFile } = await import('../../dist/node.js');
  const options = { pdf: { executablePath: process.env.DOCX_TEST_BROWSER } };
  const result = await convertToPdf(sampleDocx(), options);
  expect(Buffer.from(result.bytes).subarray(0, 5).toString()).toBe('%PDF-');
  await mkdir('.tmp/pdf', { recursive: true });
  await writeFile('.tmp/pdf/node.pdf', result.bytes);
  await writeFile('.tmp/pdf/input.docx', sampleDocx());
  const file = await convertToPdfFile('.tmp/pdf/input.docx', options);
  expect(file.stats).toEqual(result.stats);
  expect(file.bytes.length).toBeGreaterThan(5000);
});
