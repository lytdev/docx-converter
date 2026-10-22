import { attr, child, children, is, number, val } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';
export interface ListLevel { format: string; start: number; text: string; }
export class Numbering {
  private nums = new Map<string, Map<number, ListLevel>>();
  constructor(pkg: PartReader) {
    const path = pkg.related(pkg.main, 'numbering');
    const root = path ? pkg.xml(path)?.documentElement : undefined;
    const abstracts = new Map<string, Map<number, ListLevel>>();
    const level = (el: X): ListLevel => ({ format: val(child(el, 'numFmt')) ?? 'decimal', start: number(val(child(el, 'start')), 1), text: val(child(el, 'lvlText')) ?? '%1.' });
    for (const el of children(root).filter(e => is(e, 'abstractNum'))) {
      const levels = new Map<number, ListLevel>();
      for (const l of children(el).filter(e => is(e, 'lvl'))) levels.set(number(attr(l, 'ilvl')), level(l));
      abstracts.set(attr(el, 'abstractNumId') ?? '', levels);
    }
    for (const el of children(root).filter(e => is(e, 'num'))) {
      const levels = new Map(abstracts.get(val(child(el, 'abstractNumId')) ?? ''));
      for (const over of children(el).filter(e => is(e, 'lvlOverride'))) {
        const i = number(attr(over, 'ilvl')), l = child(over, 'lvl');
        const value = { ...(l ? level(l) : levels.get(i) ?? { format: 'decimal', start: 1, text: '%1.' }) };
        if (child(over, 'startOverride')) value.start = number(val(child(over, 'startOverride')), 1);
        levels.set(i, value);
      }
      this.nums.set(attr(el, 'numId') ?? '', levels);
    }
  }
  get(id: string, level: number): ListLevel | undefined { return this.nums.get(id)?.get(level); }
}
