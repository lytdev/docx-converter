import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { groupedDrawingDocx } from '../fixtures/group-drawing';

test('Worker defaults grouped drawings to a decoded high-resolution PNG', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file').setInputFiles({ name: 'drawing.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(groupedDrawingDocx()) });
  await expect(page.locator('#status')).toHaveText('转换完成');
  await expect(page.locator('#warning-count')).toHaveText('0');
  const img = page.frameLocator('#preview').locator('img');
  await expect(img).toHaveCount(1);
  expect(await img.evaluate((el: HTMLImageElement) => ({ png: el.src.startsWith('data:image/png;base64,'), width: el.naturalWidth, height: el.naturalHeight }))).toEqual({ png: true, width: 1212, height: 612 });
});

test('plain browser API selects PNG or SVG for both public conversion methods', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ path: resolve('dist/docx-html.umd.cjs') });
  const results = await page.evaluate(async bytes => {
    const api = (window as unknown as { DocxHtml: typeof import('../../src/index') }).DocxHtml;
    const input = new Uint8Array(bytes);
    const result = [];
    for (const drawingOutput of ['png', 'svg'] as const) {
      const html = await api.convertToHtml(input, { drawingOutput });
      const json = await api.convertToJson(input, { drawingOutput });
      result.push({ html: html.html.includes(`data:image/${drawingOutput === 'png' ? 'png' : 'svg+xml'};base64,`), json: JSON.stringify(json).includes(`data:image/${drawingOutput === 'png' ? 'png' : 'svg+xml'};base64,`), warnings: [...html.warnings, ...json.warnings] });
    }
    return result;
  }, Array.from(groupedDrawingDocx()));
  expect(results).toEqual([{ html: true, json: true, warnings: [] }, { html: true, json: true, warnings: [] }]);
});
