import { describe, expect, it } from 'vitest';
import { oleEquationLatex } from '../../src/modules/math/ole-equation';
import { mtefLatex } from '../../src/modules/math/mtef-latex';
import { previewConflicts } from '../../src/modules/math/preview-consistency';
import { hex, oleEquation } from '../fixtures/ole';
import { textWmf } from '../fixtures/wmf';

const bar = hex(`
  03 01 01 03 0A 0A 01 03 04 00 00 01
  32 83 78 00 06 11 00 00 02 86 12 22 02 84 BC 03
  03 0F 01 00 0B 01 02 88 30 00 00 11 00
  00 0A 02 96 07 EC 02 96 08 EC 00 00 00
`);

describe('legacy OLE equation extraction', () => {
  it('reads MTEF 3 templates, empty slots, embellishments and fractions', () => {
    expect(mtefLatex(bar)).toBe('\\left| \\bar{x}-\\mu _{0}\\right|');
    expect(mtefLatex(hex('03 01 01 03 00 01 03 0E 00 00 01 02 83 78 00 00 01 02 83 79 00 00 00 00 00'))).toBe('\\frac{x}{y}');
    expect(mtefLatex(hex('03 01 01 03 00 01 03 29 01 00 01 02 83 78 00 00 01 02 83 79 00 00 00 00 00'))).toBe('\\frac{x}{y}');
  });
  it('reads MTEF 5 scripts and metadata', () => {
    expect(mtefLatex(hex(`05 01 00 06 00 44 53 4D 54 36 00 00
      11 01 41 72 69 61 6C 00 08 01 00 12 00 01 12 F0 00 01 01 00
      0A 01 00 02 00 83 78 00 03 00 1B 00 00 01 00 02 00 88 30 00 00 01 01 00 00 00`))).toBe('x_{0}');
  });
  it('extracts Equation Native and rejects malformed containers and MTEF', () => {
    expect(oleEquationLatex(oleEquation(bar))).toBe('\\left| \\bar{x}-\\mu _{0}\\right|');
    expect(oleEquationLatex(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(oleEquationLatex(oleEquation(hex('03 01 01 03 00 01 02')))).toBeUndefined();
    const cycle = oleEquation(bar);
    new DataView(cycle.buffer).setUint32(1536, 0, true);
    expect(oleEquationLatex(cycle)).toBeUndefined();
  });
  it('omits editable text when standard-font WMF preview has different digits', () => {
    expect(previewConflicts(textWmf('x+9'), 'x_{0}')).toBe(true);
    expect(previewConflicts(textWmf('x+0'), 'x_{0}')).toBe(false);
    expect(previewConflicts(new Uint8Array([1, 2, 3]), 'x_{0}')).toBe(false);
  });
});
