import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { docx, p, mt, ns, R } from '../fixtures/docx';
import { textWmf } from '../fixtures/wmf';
import { hex, oleEquation } from '../fixtures/ole';

test('browser worker converts, previews, exports and reopens standalone HTML', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '试用示例文档' }).click();
  await expect(page.locator('#status')).toHaveText('转换完成');
  await expect(page.locator('#warning-count')).toHaveText('0');
  await page.locator('#preview').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('#preview');
  await expect(frame.getByRole('heading', { name: '文档转换 · 能力示例', exact: true })).toBeVisible();
  await expect(frame.locator('math')).toHaveCount(0); await expect(frame.locator('img.formula-image')).toHaveCount(2); await expect(frame.locator('table')).toHaveCount(1);
  expect(await frame.locator('img.formula-image').evaluateAll((images: HTMLImageElement[]) => images.every(image => image.src.startsWith('data:image/svg+xml;base64,') && image.hasAttribute('data-latex') && image.complete && image.naturalWidth > 0))).toBe(true);
  await expect(frame.locator('figure img')).toBeVisible();
  expect(await frame.locator('img').evaluateAll((images: HTMLImageElement[]) => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.getByRole('tab', { name: 'HTML 源码' }).click(); await expect(page.locator('#source')).toBeVisible();
  expect(await page.locator('#source').inputValue()).toContain('data-latex');
  await page.getByRole('tab', { name: '文档预览' }).click();
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '下载 HTML' }).click();
  const download = await downloadEvent; expect(download.suggestedFilename()).toBe('示例文档.html');
  await mkdir('.tmp', { recursive: true });
  const path = resolve('.tmp/exported.html'); await download.saveAs(path);
  const html = await readFile(path, 'utf8'); expect(html).toContain('<!DOCTYPE html>');
  const exported = await context.newPage(); await exported.goto(`file:///${path.replace(/\\/g, '/')}`);
  await expect(exported.locator('math')).toHaveCount(0); await expect(exported.locator('img.formula-image')).toHaveCount(2); await expect(exported.getByRole('heading', { name: '文档转换 · 能力示例', exact: true })).toBeVisible();
  expect(await exported.locator('img').evaluateAll((images: HTMLImageElement[]) => images.every(img => img.naturalWidth > 0))).toBe(true);
  await mkdir('.tmp/screenshots', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1050 }); await page.screenshot({ path: '.tmp/screenshots/desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('file input accepts a DOCX and invalid data produces a visible error', async ({ page }) => {
  await page.goto('/'); await page.locator('#file').setInputFiles(resolve('public/sample.docx'));
  await expect(page.locator('#status')).toHaveText('转换完成');
  await page.getByRole('tab', { name: 'HTML 源码' }).click();
  await page.locator('#file').setInputFiles(resolve('public/sample.docx'));
  await expect(page.locator('#status')).toHaveText('转换完成');
  await expect(page.locator('#preview-view')).toBeHidden();
  await page.getByRole('tab', { name: '文档预览' }).click();
  await page.locator('#preview').scrollIntoViewIfNeeded();
  await expect(page.frameLocator('#preview').getByRole('heading', { name: '文档转换 · 能力示例', exact: true })).toBeVisible();
  await page.locator('#file').setInputFiles({ name: 'bad.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('not zip') });
  await expect(page.locator('#error')).toContainText('不是 DOCX'); await expect(page.locator('#download')).toBeDisabled();
  await expect(page.locator('#preview-view')).toBeHidden();
});

test('small-screen layout stays within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: '试用示例文档' }).click(); await expect(page.locator('#status')).toHaveText('转换完成');
  await page.locator('#preview').scrollIntoViewIfNeeded();
  await expect(page.frameLocator('#preview').getByRole('heading', { name: '文档转换 · 能力示例', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mkdir('.tmp/screenshots', { recursive: true }); await page.screenshot({ path: '.tmp/screenshots/mobile.png', fullPage: true });
});

test('UMD build works through a plain script tag without bundler globals', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ path: resolve('dist/docx-html.umd.cjs') });
  const result = await page.evaluate(async () => {
    const bytes = await (await fetch('/sample.docx')).arrayBuffer();
    const api = (window as unknown as { DocxHtml: { convertDocx: (bytes: ArrayBuffer) => Promise<{ html: string; warnings: unknown[] }> } }).DocxHtml;
    const r = await api.convertDocx(bytes); return { svgImages: (r.html.match(/data:image\/svg\+xml;base64,/g) ?? []).length, hasMath: r.html.includes('<math'), warnings: r.warnings };
  });
  expect(result).toEqual({ svgImages: 2, hasMath: false, warnings: [] });
});

test('a delayed sample response cannot replace a newer file conversion', async ({ page }) => {
  let release!: () => void, started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  const bytes = await readFile(resolve('public/sample.docx'));
  await page.route('**/sample.docx', async route => {
    started(); await held;
    await route.fulfill({ status: 200, body: bytes });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '试用示例文档' }).click();
  await requested;
  await page.locator('#file').setInputFiles(resolve('public/sample.docx'));
  await expect(page.locator('#status')).toHaveText('转换完成');
  await expect(page.locator('#filename')).toHaveText('sample.docx');
  release();
  await expect(page.getByRole('button', { name: '试用示例文档' })).toBeEnabled();
  await expect(page.locator('#filename')).toHaveText('sample.docx');
  await expect(page.locator('#status')).toHaveText('转换完成');
});

test('rasterizes a MathType WMF preview, attaches LaTeX and exports original resources', async ({ page }) => {
  const wmf = textWmf();
  const ole = oleEquation(hex('03 01 01 03 00 01 02 83 78 00 02 83 2B 00 02 83 79 00 00 00'));
  const body = p('<w:r><w:object><v:shape style="width:70pt;height:30pt"><v:imagedata r:id="preview"/></v:shape><o:OLEObject ProgID="Equation.3" r:id="ole"/></w:object></w:r>');
  const bytes = docx(body, { rels: `<Relationship Id="preview" Type="${R}/image" Target="media/formula.wmf"/><Relationship Id="ole" Type="${R}/oleObject" Target="embeddings/formula.bin"/>`, media: { 'formula.wmf': wmf }, extra: { 'word/embeddings/formula.bin': ole } });
  await page.goto('/');
  await page.locator('#file').setInputFiles({ name: 'formula.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
  await expect(page.locator('#status')).toHaveText('转换完成');
  await expect(page.locator('#output-info')).toContainText('1 张公式预览 PNG');
  await page.locator('#preview').scrollIntoViewIfNeeded();
  const image = page.frameLocator('#preview').locator('img.formula-image');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('data-latex', 'x+y');
  expect(await image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#resources').click();
  const download = await downloadEvent;
  await mkdir('.tmp', { recursive: true });
  const path = resolve('.tmp/formula-resources.zip');
  await download.saveAs(path);
  const resources = unzipSync(new Uint8Array(await readFile(path)));
  expect(resources['word/media/formula.wmf']).toEqual(wmf);
  expect(resources['word/embeddings/formula.bin']).toEqual(ole);
  expect([...resources['word/media/formula.wmf.png'].subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});

test('SVG formula image keeps glyphs inside its viewport with an inherited font size', async ({ page }) => {
  const styles = `<w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const formula = `<m:oMath>${mt('P')}${mt('=')}${mt('K')}<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:e>${mt('P')}</m:e></m:nary></m:oMath>`;
  await page.goto('/');
  await page.locator('#file').setInputFiles({ name: 'formula-size.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(docx(p(formula), { styles })) });
  await expect(page.locator('#status')).toHaveText('转换完成');
  const src = await page.frameLocator('#preview').locator('img.formula-image').getAttribute('src');
  expect(src).toMatch(/^data:image\/svg\+xml;base64,/);
  const svgText = Buffer.from(src!.split(',')[1], 'base64').toString('utf8');
  const clipped = await page.evaluate(svgText => {
    const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
    document.body.append(svg);
    const bounds = svg.getBBox(), view = svg.viewBox.baseVal;
    svg.remove();
    return bounds.x < view.x - 1 || bounds.y < view.y - 1 || bounds.x + bounds.width > view.x + view.width + 1 || bounds.y + bounds.height > view.y + view.height + 1;
  }, svgText);
  expect(clipped).toBe(false);
});
