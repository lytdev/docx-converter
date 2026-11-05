import { expect, it, vi } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { groupedDrawingDocx as fixture } from '../fixtures/group-drawing';


it('selects grouped vector shapes over empty fallback images and shares SVG between HTML and JSON', async () => {
  const json = await convertToJson(fixture(), { drawingOutput: 'svg' });
  const block = json.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'image') throw new Error('Missing drawing');
  const image = block.children[0];
  expect(block.children).toHaveLength(1);
  expect(image.alt).toBe('养老 & <金融>');
  const svg = Buffer.from(image.src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('scale(2 2)');
  expect(svg).toContain('<rect');
  expect(svg).toContain('养老 &amp; &lt;金融&gt;');
  expect(svg).toContain('M100 0L0 40');
  expect(svg).toContain('Z" fill="#000000"');
  expect(json.stats.images).toBe(1);
  expect(json.warnings).toEqual([]);
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

it('retains text with a diagnostic for unsupported grouped geometry', async () => {
  const result = await convertToHtml(fixture('unsupportedShape'));
  expect(result.warnings.some(w => w.code === 'UNSUPPORTED_GROUP_DRAWING')).toBe(true);
  expect(result.html).toContain('养老 &amp; &lt;金融&gt;');
  expect(result.warnings.some(w => w.code === 'MISSING_IMAGE')).toBe(false);
});

it('defaults to 3x PNG in both outputs without changing display dimensions', async () => {
  const result = await convertToJson(fixture());
  const block = result.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'image') throw new Error('Missing drawing');
  const image = block.children[0];
  expect(image.src).toMatch(/^data:image\/png;base64,/);
  const bytes = Buffer.from(image.src!.split(',')[1], 'base64');
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.readUInt32BE(16)).toBe(404 * 3);
  expect(bytes.readUInt32BE(20)).toBe(204 * 3);
  expect(image.width).toBe(404); expect(image.height).toBe(204);
  expect(result.warnings).toEqual([]);
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
