import { describe, expect, it } from 'vitest';
import { pt, round2 } from '../../src/shared/units';

describe('numeric units', () => {
  it('rounds decimals to at most two places', () => {
    expect(round2(1.7208333333333334)).toBe(1.72);
    expect(round2(17.66666666666667)).toBe(17.67);
    expect(round2(53 / 3)).toBe(17.67);
    expect(round2(1)).toBe(1);
    expect(round2(0)).toBe(0);
  });

  it('formats point values with at most two decimals', () => {
    expect(pt(17.66666666666667)).toBe('17.67pt');
    expect(pt(595.3)).toBe('595.3pt');
    expect(pt(72)).toBe('72pt');
  });
});
