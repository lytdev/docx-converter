import { attr, child, descendants, number } from '../../infrastructure/xml/dom.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';
import { noteParagraphText } from './note-text.js';

export interface FootnoteDefinitions {
  entries: ReadonlyMap<string, string>;
  numberFormat: string;
  numberStart: number;
}

/** Reads footnote bodies and document-wide footnote numbering settings. */
export function readFootnotes(source: PartReader): FootnoteDefinitions {
  const entries = new Map<string, string>();
  const path = source.related(source.main, 'footnotes');
  const root = path ? source.xml(path)?.documentElement : undefined;
  if (root) {
    for (const footnote of descendants(root, 'footnote')) {
      const id = attr(footnote, 'id');
      const type = attr(footnote, 'type');
      if (id === undefined || (type !== undefined && type !== 'normal')) continue;
      entries.set(id, noteParagraphText(footnote).trim());
    }
  }

  const settingsPath = source.related(source.main, 'settings');
  const settings = settingsPath ? source.xml(settingsPath)?.documentElement : undefined;
  const footnotePr = child(settings, 'footnotePr');
  return {
    entries,
    numberFormat: attr(child(footnotePr, 'numFmt'), 'val') ?? 'decimal',
    numberStart: number(attr(child(footnotePr, 'numStart'), 'val'), 1),
  };
}

const CIRCLED_NUMBERS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

export function formatFootnoteNumber(value: number, format: string): string {
  if (['decimalEnclosedCircle', 'decimalEnclosedCircleChinese', 'ideographEnclosedCircle'].includes(format)
    && value >= 1 && value <= CIRCLED_NUMBERS.length)
    return CIRCLED_NUMBERS[value - 1];
  if (format === 'decimalZero') return String(value).padStart(2, '0');
  if (format === 'decimalFullWidth') return String(value).replace(/\d/g, digit => String.fromCharCode(0xff10 + Number(digit)));
  return String(value);
}
