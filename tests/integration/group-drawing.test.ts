import { expect, it, vi } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { groupedDrawingDocx as fixture } from '../fixtures/group-drawing';
import { jsonElement } from '../fixtures/html-json';


it('selects grouped vector shapes over empty fallback images and shares SVG between HTML and JSON', async () => {
  const json = await convertToJson(fixture(), { drawingOutput: 'svg' });
  const image = jsonElement(json, 'img');
  expect(json.elements[0].children).toHaveLength(1);
  expect(image.alt).toBe('养老 & <金融>');
  const svg = Buffer.from(image.src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('scale(2 2)');
  expect(svg).toContain('<rect');
  expect(svg).toContain('养老 &amp; &lt;金融&gt;');
  expect(svg).toContain('M100 0L0 40');
  expect(svg).toContain('Z" fill="#000000"');
  const html = await convertToHtml(fixture(), { drawingOutput: 'svg' });
  expect(html.html).toContain(image.src);
  expect(html.warnings).toEqual([]);
});

it('passes generated group SVG through the configured oversized image callback', async () => {
  const upload = vi.fn(async (blob: Blob, suffix: string, name: string) => {
    expect(blob.type).toBe('image/svg+xml');
    expect(await blob.text()).toContain('<text');
    expect(suffix).toBe('svg'); expect(name).toBe('drawing.svg');
    return { fileUrl: 'https://example.com/drawing.svg' };
  });
  const result = await convertToHtml(fixture(), { drawingOutput: 'svg', imageHandler: { base64ImageSize: 0, processLargeImage: upload } });
  expect(upload).toHaveBeenCalledTimes(1);
  expect(result.html).toContain('src="https://example.com/drawing.svg"');
});

it('approximates unknown grouped geometry without dropping the whole drawing', async () => {
  const result = await convertToHtml(fixture('unsupportedShape'), { drawingOutput: 'svg' });
  expect(result.warnings).toEqual([]);
  expect(result.html).toContain('data:image/svg+xml;base64,');
  expect(result.html).toContain('alt="养老 &amp; &lt;金融&gt;"');
  expect(result.warnings.some(w => w.code === 'MISSING_IMAGE')).toBe(false);
});

it('renders common arrow geometry inside grouped drawings', async () => {
  const result = await convertToHtml(fixture('downArrow'), { drawingOutput: 'svg' });
  expect(result.warnings).toEqual([]);
  const src = result.html.match(/data:image\/svg\+xml;base64,([^"]+)/)?.[1];
  if (!src) throw new Error('Missing SVG');
  const svg = Buffer.from(src, 'base64').toString('utf8');
  expect(svg).toContain('L75 40L0 23.2');
});

it('renders common preset geometries instead of rejecting the group', async () => {
  for (const geometry of ['parallelogram', 'hexagon', 'chevron', 'flowChartDecision', 'star5']) {
    const result = await convertToHtml(fixture(geometry), { drawingOutput: 'svg' });
    expect(result.warnings, geometry).toEqual([]);
    expect(result.html, geometry).toContain('data:image/svg+xml;base64,');
  }
});

it('defaults to 3x PNG in both outputs without changing display dimensions', async () => {
  const result = await convertToJson(fixture());
  const image = jsonElement(result, 'img');
  expect(image.src).toMatch(/^data:image\/png;base64,/);
  const bytes = Buffer.from(image.src!.split(',')[1], 'base64');
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.readUInt32BE(16)).toBe(404 * 3);
  expect(bytes.readUInt32BE(20)).toBe(204 * 3);
  expect(image.style.width).toBe('404px'); expect(image.style.height).toBe('204px');
  const html = await convertToHtml(fixture(), { drawingOutput: 'png' });
  expect(html.html).toContain(image.src);
});

it('uploads PNG bytes and uses the returned fileUrl after rasterization', async () => {
  const upload = vi.fn(async (blob: Blob, suffix: string, name: string) => {
    expect(blob.type).toBe('image/png');
    expect(suffix).toBe('png'); expect(name).toBe('drawing.png');
    expect(new Uint8Array(await blob.arrayBuffer())[0]).toBe(137);
    return { fileUrl: 'https://example.com/drawing.png' };
  });
  const result = await convertToHtml(fixture(), { imageHandler: { base64ImageSize: 0, processLargeImage: upload } });
  expect(upload).toHaveBeenCalledTimes(1);
  expect(result.html).toContain('src="https://example.com/drawing.png"');
});

it('rejects invalid drawing format values', async () => {
  await expect(convertToHtml(fixture(), { drawingOutput: 'jpeg' as 'png' })).rejects.toThrow('drawingOutput');
  await expect(convertToHtml(fixture(), { generatedImageOutput: 'jpeg' as 'png' })).rejects.toThrow('generatedImageOutput');
});
