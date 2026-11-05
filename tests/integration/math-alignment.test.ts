import { expect, it } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { docx, p, mt } from '../fixtures/docx';

it('keeps space indentation when rows have independent left-hand expressions', async () => {
  const input = docx(p(`<m:oMath><m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:mcJc m:val="left"/></m:mcPr></m:mc></m:mcs></m:mPr><m:mr><m:e>${mt('x=1')}</m:e></m:mr><m:mr><m:e>${mt('      y=2')}</m:e></m:mr></m:m></m:oMath>`));
  const result = await convertToJson(input, { generatedImageOutput: 'svg' });
  const block = result.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'math') throw new Error('Missing math');
  expect(block.children[0].mathml).toContain('columnalign="left"');
  expect(block.children[0].mathml).toContain('<mspace width="1.5em"/>');
  expect(block.children[0].latex).toContain('\\begin{array}{l}');
});

it('aligns space-indented continuation equations at equals in HTML and JSON', async () => {
  const input = docx(p(`<m:oMath><m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="1"/><m:mcJc m:val="left"/></m:mcPr></m:mc></m:mcs></m:mPr><m:mr><m:e>${mt('K=long expression')}</m:e></m:mr><m:mr><m:e>${mt('      ')}${mt('=result')}</m:e></m:mr></m:m></m:oMath>`));
  const result = await convertToJson(input, { generatedImageOutput: 'svg' });
  const block = result.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'math') throw new Error('Missing math');
  const formula = block.children[0];
  expect(formula.mathml).toContain('columnalign="right left" columnspacing="0em"');
  expect(formula.mathml).not.toContain('<mspace width="1.5em"/>');
  expect(formula.latex).toContain('\\begin{aligned}K&=');
  expect(formula.latex).toContain('\\\\&=result');
  expect(formula.src).toMatch(/^data:image\/svg\+xml;base64,/);
  const html = await convertToHtml(input, { generatedImageOutput: 'svg' });
  expect(html.html).toContain(formula.src);
  expect(html.warnings).toEqual([]);
});

it('expands matrix column counts and keeps unspecified columns centered', async () => {
  const input = docx(p(`<m:oMath><m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="2"/><m:mcJc m:val="right"/></m:mcPr></m:mc></m:mcs></m:mPr><m:mr>${[1, 2, 3].map(n => `<m:e>${mt(String(n))}</m:e>`).join('')}</m:mr></m:m></m:oMath>`));
  const result = await convertToJson(input);
  const block = result.document.blocks[0];
  if (block.kind !== 'paragraph' || block.children[0].kind !== 'math') throw new Error('Missing math');
  expect(block.children[0].mathml).toContain('columnalign="right right center"');
  expect(block.children[0].latex).toContain('\\begin{array}{rrc}');
});
