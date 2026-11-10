import { attr, number } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import { pt, round2 } from '../../shared/units.js';
export function width(el?: X): string | undefined {
  const v = attr(el, 'w'), t = attr(el, 'type');
  if (v === undefined || t === 'auto' || t === 'nil') return;
  return t === 'pct' ? `${round2(number(v) / 50)}%` : pt(number(v) / 20);
}
