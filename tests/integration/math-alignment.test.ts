import { expect, it } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { docx, p, mt } from '../fixtures/docx';
import { jsonElement, jsonElements } from '../fixtures/html-json';

it('keeps space indentation when rows have independent left-hand expressions', async () => {
  const input = docx(p(`<m:oMath><m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:mcJc m:val="left"/></m:mcPr></m:mc></m:mcs></m:mPr><m:mr><m:e>${mt('x=1')}</m:e></m:mr><m:mr><m:e>${mt('      y=2')}</m:e></m:mr></m:m></m:oMath>`));
  const result = await convertToJson(input, { generatedImageOutput: 'svg' });
  expect(jsonElement(result, 'img').attribute['data-latex']).toContain('\\begin{array}{l}');
  const mathml = await convertToJson(input, { formulaOutput: 'mathml' });
  expect(jsonElement(mathml, 'mtable').columnalign).toBe('left');
  expect(jsonElements(mathml, 'mspace')[0].width).toBe('1.5em');
});

it('aligns space-indented continuation equations at equals in HTML and JSON', async () => {
  const input = docx(p(`<m:oMath><m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="1"/><m:mcJc m:val="left"/></m:mcPr></m:mc></m:mcs></m:mPr><m:mr><m:e>${mt('K=long expression')}</m:e></m:mr><m:mr><m:e>${mt('      ')}${mt('=result')}</m:e></m:mr></m:m></m:oMath>`));
  const result = await convertToJson(input, { generatedImageOutput: 'svg' });
  const formula = jsonElement(result, 'img');
  const latex = formula.attribute['data-latex'];
  expect(latex).toContain('\\begin{aligned}K&=');
  expect(latex).toContain('\\\\&=result');
  expect(formula.src).toMatch(/^data:image\/svg\+xml;base64,/);
  const mathml = await convertToJson(input, { formulaOutput: 'mathml' });
  const table = jsonElement(mathml, 'mtable');
  expect(table.columnalign).toBe('right left');
  expect(table.columnspacing).toBe('0em');
  expect(jsonElements(mathml, 'mspace').some(node => node.width === '1.5em')).toBe(false);
  const html = await convertToHtml(input, { generatedImageOutput: 'svg' });
  expect(html.html).toContain(formula.src);
  expect(html.warnings).toEqual([]);
});

it('expands matrix column counts and keeps unspecified columns centered', async () => {
  const input = docx(p(`<m:oMath><m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="2"/><m:mcJc m:val="right"/></m:mcPr></m:mc></m:mcs></m:mPr><m:mr>${[1, 2, 3].map(n => `<m:e>${mt(String(n))}</m:e>`).join('')}</m:mr></m:m></m:oMath>`));
  const result = await convertToJson(input);
  expect(jsonElement(result, 'img').attribute['data-latex']).toContain('\\begin{array}{rrc}');
  const mathml = await convertToJson(input, { formulaOutput: 'mathml' });
  expect(jsonElement(mathml, 'mtable').columnalign).toBe('right right center');
});
