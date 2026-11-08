import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { docx, p, mt, ns, R, image, png } from '../fixtures/docx';
import { mathParagraph, universityFormulas } from '../fixtures/university-formulas';
import { textWmf } from '../fixtures/wmf';
import { emf } from '../fixtures/emf';
import { hex, oleEquation } from '../fixtures/ole';
import { jsonElements } from '../fixtures/html-json';

async function convertHtml(
  page: Page,
  bytes: Uint8Array,
  options: Record<string, unknown> = {},
): Promise<{ html: string; warnings: unknown[] }> {
  await page.goto('/');
  await page.addScriptTag({ path: resolve('dist/docx-converter.umd.cjs') });
  return page.evaluate(async ({ data, options }) => {
    const api = (window as unknown as { DocxConverter: {
      convertToHtml: (bytes: Uint8Array, options: Record<string, unknown>) => Promise<{ html: string; warnings: unknown[] }>;
    } }).DocxConverter;
    return api.convertToHtml(Uint8Array.from(data), options);
  }, { data: [...bytes], options });
}

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
  expect(await frame.locator('img.formula-image').evaluateAll((images: HTMLImageElement[]) => images.every(image =>
    image.src.startsWith('data:image/png;base64,') && image.getAttribute('data-type') === 'formula' &&
    image.classList.contains('formula-item') && image.classList.contains('formula-image') &&
    image.hasAttribute('data-latex') && image.complete && image.naturalWidth > 0
  ))).toBe(true);
  expect(await frame.locator('img.formula-image').evaluateAll((images: HTMLImageElement[]) =>
    images.map(image => image.classList.contains('image-inline') ? 'inline' : image.classList.contains('image-block') ? 'block' : 'missing')
  )).toEqual(['inline', 'block']);
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
  const jsonEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '下载 JSON' }).click();
  const jsonDownload = await jsonEvent; expect(jsonDownload.suggestedFilename()).toBe('示例文档.json');
  const jsonPath = resolve('.tmp/exported.json'); await jsonDownload.saveAs(jsonPath);
  const json = JSON.parse(await readFile(jsonPath, 'utf8'));
  expect(json.elements.length).toBeGreaterThan(5);
  expect(json.meta).toEqual({ title: '示例文档' });
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
  await page.addScriptTag({ path: resolve('dist/docx-converter.umd.cjs') });
  const result = await page.evaluate(async () => {
    const bytes = await (await fetch('/sample.docx')).arrayBuffer();
    const api = (window as unknown as { DocxConverter: {
      convertToHtml: (bytes: ArrayBuffer) => Promise<{ html: string; warnings: unknown[] }>;
      convertToJson: (bytes: ArrayBuffer) => Promise<{ meta: { title: string }; elements: { tag: string }[] }>;
    } }).DocxConverter;
    const [r, json] = await Promise.all([api.convertToHtml(bytes), api.convertToJson(bytes)]);
    return { pngImages: (r.html.match(/data:image\/png;base64,/g) ?? []).length, hasMath: r.html.includes('<math'), warnings: r.warnings,
      jsonHasElements: json.elements.length > 5, jsonFirst: json.elements[0]?.tag, jsonTitle: json.meta.title,
      oldExportsAbsent: !('convertDocx' in api) && !('convertDocxToJson' in api) };
  });
  expect(result).toEqual({ pngImages: 3, hasMath: false, warnings: [], jsonHasElements: true, jsonFirst: 'h1', jsonTitle: '', oldExportsAbsent: true });
});

test('plain browser script can offload images above the byte limit', async ({ page }) => {
  const bytes = docx(p(image()), { rels: `<Relationship Id="image1" Type="${R}/image" Target="media/photo.png"/>`, media: { 'photo.png': png } });
  await page.goto('/');
  await page.route('**/uploaded/photo.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(png) }));
  await page.addScriptTag({ path: resolve('dist/docx-converter.umd.cjs') });
  const result = await page.evaluate(async data => {
    const api = (window as unknown as { DocxConverter: { convertToHtml: (bytes: Uint8Array, options: unknown) => Promise<{ html: string }> } }).DocxConverter;
    let upload: { size: number; suffix: string; name: string } | undefined;
    const converted = await api.convertToHtml(Uint8Array.from(data), { imageHandler: {
      base64ImageSize: 0,
      processLargeImage: async (blob: Blob, suffix: string, name: string) => {
        upload = { size: blob.size, suffix, name };
        return { fileUrl: '/uploaded/photo.png', fileSize: blob.size, fileName: name };
      },
    } });
    return { upload, html: converted.html, externalUrl: converted.html.includes('src="/uploaded/photo.png"'), embedded: converted.html.includes('data:image/png;base64,') };
  }, [...bytes]);
  expect(result.upload).toEqual({ size: png.length, suffix: 'png', name: 'photo.png' });
  expect(result.externalUrl).toBe(true); expect(result.embedded).toBe(false);
  await page.evaluate(html => {
    const frame = document.createElement('iframe');
    frame.id = 'upload-preview'; frame.style.cssText = 'display:block;width:320px;height:120px';
    frame.srcdoc = html; document.body.append(frame);
  }, result.html);
  const uploadedImage = page.frameLocator('#upload-preview').locator('img');
  await expect(uploadedImage).toBeVisible();
  expect(await uploadedImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
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

test('rasterizes a normal EMF image and includes both PNG and original EMF in downloads', async ({ page }) => {
  const bytes = docx(p(image()), { rels: `<Relationship Id="image1" Type="${R}/image" Target="media/shape.emf"/>`, media: { 'shape.emf': emf } });
  await page.goto('/');
  await page.locator('#file').setInputFiles({ name: 'emf.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
  await expect(page.locator('#status')).toHaveText('转换完成');
  await expect(page.locator('#warning-count')).toHaveText('0');
  const emfImage = page.frameLocator('#preview').locator('img.image-item');
  await expect(emfImage).toBeVisible();
  const src = await emfImage.getAttribute('src');
  expect(src).toMatch(/^data:image\/png;base64,/);
  expect(await emfImage.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  const jsonEvent = page.waitForEvent('download'); await page.locator('#json').click();
  const jsonDownload = await jsonEvent;
  await mkdir('.tmp', { recursive: true });
  const jsonPath = resolve('.tmp/emf.json'); await jsonDownload.saveAs(jsonPath);
  const json = JSON.parse(await readFile(jsonPath, 'utf8'));
  expect(jsonElements(json, 'img')[0].src).toMatch(/^data:image\/png;base64,/);
  const zipEvent = page.waitForEvent('download'); await page.locator('#resources').click();
  const zipDownload = await zipEvent;
  const zipPath = resolve('.tmp/emf-resources.zip'); await zipDownload.saveAs(zipPath);
  const resources = unzipSync(new Uint8Array(await readFile(zipPath)));
  expect(resources['word/media/shape.emf']).toEqual(emf);
  expect([...resources['word/media/shape.emf.png'].subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  await page.addScriptTag({ path: resolve('dist/docx-converter.umd.cjs') });
  const umdSrc = await page.evaluate(async data => {
    const api = (window as unknown as { DocxConverter: { convertToHtml: (bytes: Uint8Array) => Promise<{ html: string }> } }).DocxConverter;
    const converted = await api.convertToHtml(Uint8Array.from(data));
    return new DOMParser().parseFromString(converted.html, 'text/html').querySelector('img')?.getAttribute('src');
  }, [...bytes]);
  expect(umdSrc).toMatch(/^data:image\/png;base64,/);
});

test('rasterizes a MathType WMF preview, attaches LaTeX and exports original resources', async ({ page }) => {
  const wmf = textWmf();
  const ole = oleEquation(hex('03 01 01 03 00 01 02 83 78 00 02 83 2B 00 02 83 79 00 00 00'));
  const body = p('<w:r><w:object><v:shape style="width:70pt;height:30pt"><v:imagedata r:id="preview"/></v:shape><o:OLEObject ProgID="Equation.3" r:id="ole"/></w:object></w:r>');
  const bytes = docx(body, { rels: `<Relationship Id="preview" Type="${R}/image" Target="media/formula.wmf"/><Relationship Id="ole" Type="${R}/oleObject" Target="embeddings/formula.bin"/>`, media: { 'formula.wmf': wmf }, extra: { 'word/embeddings/formula.bin': ole } });
  await page.goto('/');
  await page.locator('#file').setInputFiles({ name: 'formula.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
  await expect(page.locator('#status')).toHaveText('转换完成');
  await expect(page.locator('#output-info')).toContainText('1 张转码 PNG');
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

test('long inline formula has a small right margin without clipping', async ({ page }) => {
  const formula = `<m:oMath>${mt('S(x)=1−F(x)=1−P(X≤x)=P(X&gt;x)')}</m:oMath>`;
  const result = await convertHtml(page, docx(p(formula)), { generatedImageOutput: 'svg' });
  await page.setContent(result.html);
  const src = await page.locator('img.formula-image').getAttribute('src');
  const svgText = Buffer.from(src!.split(',')[1], 'base64').toString('utf8');
  const gap = await page.evaluate(xml => {
    const svg = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
    document.body.append(svg);
    const bounds = svg.getBBox(), view = svg.viewBox.baseVal;
    const result = view.x + view.width - bounds.x - bounds.width;
    svg.remove(); return result;
  }, svgText);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(300); // Less than 0.3em, independent of expression length.
});

test('SVG formula image keeps glyphs inside its viewport with an inherited font size', async ({ page }) => {
  const styles = `<w:styles ${ns}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const formula = `<m:oMath>${mt('P')}${mt('=')}${mt('K')}<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:e>${mt('P')}</m:e></m:nary></m:oMath>`;
  const result = await convertHtml(page, docx(p(formula), { styles }), { generatedImageOutput: 'svg' });
  await page.setContent(result.html);
  const src = await page.locator('img.formula-image').getAttribute('src');
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

test('renders the 300+ formula corpus inline and as display equations without load or clipping failures', async ({ page }) => {
  const body = universityFormulas.map(formula => p(mathParagraph(formula, 'inline')) + p(mathParagraph(formula, 'display'))).join('');
  const result = await convertHtml(page, docx(body), { generatedImageOutput: 'svg' });
  expect(result.warnings).toEqual([]);
  await page.setContent(result.html);
  await expect(page.locator('img.formula-image')).toHaveCount(universityFormulas.length * 2, { timeout: 120_000 });

  const failures = await page.locator('img.formula-image').evaluateAll((images: HTMLImageElement[]) => {
    const problems: string[] = [];
    images.forEach((image, index) => {
      if (!image.complete || image.naturalWidth === 0) { problems.push(`#${index} did not load`); return; }
      try {
        const bytes = Uint8Array.from(atob(image.src.split(',')[1]), char => char.charCodeAt(0));
        const svg = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'image/svg+xml').documentElement as unknown as SVGSVGElement;
        // MathJax nests an <svg> viewport inside stretched delimiters. Its
        // getBBox reports the unclipped glyph, so measure the viewport box
        // instead of the inner content.
        const clone = svg.cloneNode(true) as SVGSVGElement;
        for (const nested of Array.from(clone.querySelectorAll('svg svg'))) {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          for (const name of ['x', 'y', 'width', 'height']) if (nested.hasAttribute(name)) rect.setAttribute(name, nested.getAttribute(name)!);
          nested.replaceWith(rect);
        }
        document.body.append(clone);
        const bounds = clone.getBBox(), view = svg.viewBox.baseVal;
        clone.remove();
        const overflow = {
          left: +(view.x - bounds.x).toFixed(1), top: +(view.y - bounds.y).toFixed(1),
          right: +(bounds.x + bounds.width - (view.x + view.width)).toFixed(1), bottom: +(bounds.y + bounds.height - (view.y + view.height)).toFixed(1),
        };
        if (Math.max(overflow.left, overflow.top, overflow.right, overflow.bottom) > 1) {
          problems.push(`#${index} «${image.alt.slice(0, 60)}» glyphs outside viewBox: ${JSON.stringify(overflow)}`);
        }
      } catch (error) {
        problems.push(`#${index} «${image.alt.slice(0, 60)}» ${String(error)}`);
      }
    });
    return problems;
  });
  expect(failures).toEqual([]);
});
