import { expect, it } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { smartArtDocx } from '../fixtures/smartart';

it('renders cached SmartArt layout shapes and text as one generated image', async () => {
  const json = await convertToJson(smartArtDocx(), { generatedImageOutput: 'svg' });
  const block = json.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'image') throw new Error('Missing SmartArt');
  const image = block.children[0];
  expect(image.alt).toBe('步骤一；步骤二');
  expect(image.generatedKind).toBe('drawing');
  const svg = Buffer.from(image.src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('<rect');
  expect(svg).toContain('<path');
  expect(svg).toContain('步骤一');
  expect(svg).toContain('步骤二');
  expect(json.warnings).toEqual([]);

  const html = await convertToHtml(smartArtDocx(), { generatedImageOutput: 'svg' });
  expect(html.html).toContain(image.src!);
  expect(html.warnings).toEqual([]);

  const png = await convertToJson(smartArtDocx());
  const pngBlock = png.document.blocks[0];
  if (pngBlock.kind !== 'paragraph' || pngBlock.children[0].kind !== 'image') throw new Error('Missing PNG SmartArt');
  expect(pngBlock.children[0].src).toMatch(/^data:image\/png;base64,/);
});

it('keeps common and unknown SmartArt presets instead of dropping the diagram', async () => {
  const result = await convertToJson(smartArtDocx([
    { geometry: 'roundRect', text: 'A' },
    { geometry: 'chevron', text: 'B' },
    { geometry: 'hexagon', text: 'C' },
    { geometry: 'flowChartDecision', text: 'D' },
    { geometry: 'star5', text: 'E' },
    { geometry: 'unknownPreset', text: 'F' },
  ]), { generatedImageOutput: 'svg' });
  const block = result.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'image') throw new Error('Missing SmartArt');
  const svg = Buffer.from(block.children[0].src!.split(',')[1], 'base64').toString('utf8');
  for (const text of ['A', 'B', 'C', 'D', 'E', 'F']) expect(svg).toContain(`>${text}</text>`);
  expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(4);
  expect(result.warnings).toEqual([]);
});

it('draws SmartArt circular arrows with the end arrow on the lower arc', async () => {
  const result = await convertToJson(smartArtDocx([
    { geometry: 'circularArrow', text: '' },
  ]), { generatedImageOutput: 'svg' });
  const block = result.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'image') throw new Error('Missing SmartArt');
  const svg = Buffer.from(block.children[0].src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('stroke="#DDE7F5"');
  expect(svg).toContain('fill="#DDE7F5"');
  expect(svg).toContain('A180 90 0 0 1 380 170');
});

it('draws paired circular arrows as separated upper and lower semicircles', async () => {
  const result = await convertToJson(smartArtDocx([
    { geometry: 'circularArrow', text: '' },
    { geometry: 'circularArrow', text: '' },
  ]), { generatedImageOutput: 'svg' });
  const block = result.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'image') throw new Error('Missing SmartArt');
  const svg = Buffer.from(block.children[0].src!.split(',')[1], 'base64').toString('utf8');
  expect(svg).toContain('rotate(180');
  expect((svg.match(/#DDE7F5/g) ?? []).length).toBeGreaterThanOrEqual(4);
});
