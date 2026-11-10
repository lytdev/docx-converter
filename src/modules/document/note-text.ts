import { children, is } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';

function nodeText(el: X): string {
  if (is(el, 't') || is(el, 'delText')) return el.textContent ?? '';
  if (is(el, 'tab')) return '\t';
  if (is(el, 'br') || is(el, 'cr')) return '\n';
  return children(el).map(nodeText).join('');
}

/** Extracts paragraph text from a comment or note part, excluding marker-only runs. */
export function noteParagraphText(container: X): string {
  return children(container)
    .filter(child => is(child, 'p'))
    .map(paragraph => children(paragraph).map(nodeText).join(''))
    .join('\n');
}
