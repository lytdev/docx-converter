export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const pt = (n: number): string => `${round2(n)}pt`;
export function color(s?: string): string | undefined { return s === 'auto' ? '#000000' : s && /^[\da-f]{6}$/i.test(s) ? `#${s}` : undefined; }
