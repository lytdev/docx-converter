import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { convertToJson } from '../../src/index';
import { docx, p } from '../fixtures/docx';
import { formulaCategories, mathParagraph, universityFormulas } from '../fixtures/university-formulas';
import type { FormulaCase } from '../fixtures/university-formulas';
import { jsonElement, jsonElements } from '../fixtures/html-json';

const REQUIRED_CATEGORIES = ['不等式', '不定积分', '常微分方程', '代数', '定积分', '概率论与数理统计', '极限', '矩阵与线性代数', '无穷级数与级数展开', '曲线积分与重积分'];

function formulaImages(document: Parameters<typeof jsonElements>[0]) {
  return jsonElements(document, 'img').filter(node => node.attribute['data-type'] === 'formula');
}

function hasTag(node: ReturnType<typeof jsonElement>, tag: string): boolean {
  return node.tag === tag || node.children.some(child => hasTag(child, tag));
}

/** Structural checks that catch MathJax failures without needing a browser. */
function inspectSvg(src: string): string[] {
  const errors: string[] = [];
  const prefix = 'data:image/svg+xml;base64,';
  if (!src.startsWith(prefix)) return [`src is not a base64 SVG data URL: ${src.slice(0, 40)}`];
  const svg = Buffer.from(src.slice(prefix.length), 'base64').toString('utf8');
  if (!svg.startsWith('<svg ')) errors.push('missing <svg> root');
  if (svg.length < 200) errors.push(`suspiciously small SVG (${svg.length} chars)`);
  if (svg.length > 4 * 1024 * 1024) errors.push('SVG exceeds the 4 MB limit');
  if (/\b(?:NaN|undefined|Infinity)\b/.test(svg)) errors.push('non-finite value inside SVG');
  if (!/(<path\b|<text\b)/.test(svg)) errors.push('SVG contains no glyph content');

  const box = svg.match(/\bviewBox="([^"]+)"/)?.[1];
  if (!box) errors.push('missing viewBox');
  else {
    const values = box.trim().split(/\s+/).map(Number);
    if (values.length !== 4 || values.some(value => !Number.isFinite(value))) errors.push(`invalid viewBox: ${box}`);
    else if (values[2] <= 0 || values[3] <= 0) errors.push(`non-positive viewBox: ${box}`);
    else if (values[2] > 2_000_000 || values[3] > 2_000_000) errors.push(`absurd viewBox: ${box}`);
  }

  const size = svg.match(/\bwidth="([\d.]+)ex" height="([\d.]+)ex"/);
  if (!size) errors.push('missing ex-based width/height');
  else if (!(Number(size[1]) > 0) || !(Number(size[2]) > 0)) errors.push(`non-positive image size: ${size[0]}`);

  try {
    const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    if (!root || root.localName !== 'svg') errors.push('SVG is not well-formed XML');
    else if (!root.getAttribute('viewBox')) errors.push('parsed SVG lost its viewBox');
  } catch (error) {
    errors.push(`SVG did not parse: ${String(error)}`);
  }
  return errors;
}

async function inspectFormula(formula: FormulaCase): Promise<string[]> {
  const errors: string[] = [];
  for (const layout of ['inline', 'display'] as const) {
    const label = layout === 'display' ? '独立公式' : '行内公式';
    try {
      errors.push(...(await inspectLayout(formula, layout)).map(error => `${label}: ${error}`));
    } catch (error) {
      errors.push(`${label}: threw ${String(error)}`);
    }
  }
  return errors;
}

async function inspectLayout(formula: FormulaCase, layout: 'inline' | 'display'): Promise<string[]> {
  const errors: string[] = [];
  const display = layout === 'display';
  const result = await convertToJson(docx(p(mathParagraph(formula, layout))), { generatedImageOutput: 'svg' });

  const nodes = formulaImages(result);
  if (nodes.length !== 1) return [...errors, `expected one formula image, found ${nodes.length}`];

  const node = nodes[0];
  const isDisplay = node.class.includes('image-block');
  if (isDisplay !== display) errors.push(`formula image display=${isDisplay}`);
  const latex = node.attribute['data-latex'];
  if (typeof latex !== 'string' || !latex) errors.push('missing reconstructed LaTeX');
  if (!node.src) errors.push('missing SVG src');
  else errors.push(...inspectSvg(node.src));

  // Word stacks n-ary limits only in display equations; inline equations always
  // keep them on the right, regardless of m:limLoc="undOvr".
  const wantsStacked = display && /m:limLoc\s+m:val="undOvr"/.test(formula.omml);
  if (wantsStacked) {
    const mathml = await convertToJson(docx(p(mathParagraph(formula, layout))), { formulaOutput: 'mathml' });
    const stacked = hasTag(jsonElement(mathml, 'math'), 'munderover');
    if (!stacked) errors.push('display equation did not stack undOvr n-ary limits');
  }
  return errors;
}

describe('university formula corpus', () => {
  it('covers at least 300 formulas across the requested areas', () => {
    expect(universityFormulas.length).toBeGreaterThanOrEqual(300);
    const categories = formulaCategories.map(group => group.category);
    for (const required of REQUIRED_CATEGORIES) expect(categories).toContain(required);
    const names = universityFormulas.map(formula => formula.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('falls back to text glyphs for unbundled font ranges without failing the image', async () => {
    const result = await convertToJson(docx(p('<m:oMath><m:r><m:t>éЖ</m:t></m:r></m:oMath>')), { generatedImageOutput: 'svg' });
    const nodes = formulaImages(result);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].src).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(inspectSvg(nodes[0].src!)).toEqual([]);
  });

  describe.each(formulaCategories)('$category', ({ formulas }) => {
    it(`converts all ${formulas.length} formulas as inline and display equations`, async () => {
      const failures: string[] = [];
      for (const formula of formulas) {
        try {
          const errors = await inspectFormula(formula);
          if (errors.length) failures.push(`«${formula.name}» ${errors.join('; ')}`);
        } catch (error) {
          failures.push(`«${formula.name}» threw ${String(error)}`);
        }
      }
      expect(failures).toEqual([]);
    }, 30_000);
  });
});
