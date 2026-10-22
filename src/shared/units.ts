export const pt = (n: number): string => `${Math.round(n * 1000) / 1000}pt`;
export function color(s?: string): string | undefined { return s === 'auto' ? '#000000' : s && /^[\da-f]{6}$/i.test(s) ? `#${s}` : undefined; }
