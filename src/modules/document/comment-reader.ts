import { attr, children, descendants, is } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';

function paragraphText(paragraph: X): string {
  return children(paragraph).map(nodeText).join('');
}

function nodeText(el: X): string {
  if (is(el, 't') || is(el, 'delText')) return el.textContent ?? '';
  if (is(el, 'tab')) return '\t';
  if (is(el, 'br') || is(el, 'cr')) return '\n';
  return children(el).map(nodeText).join('');
}

/** Reads Word comment bodies keyed by the w:id used by commentRange markers in the main document. */
export function readCommentAnnotations(source: PartReader): Map<string, string> {
  const path = source.related(source.main, 'comments');
  if (!path) return new Map();
  const root = source.xml(path)?.documentElement;
  if (!root) return new Map();

  const annotations = new Map<string, string>();
  for (const comment of descendants(root, 'comment')) {
    const id = attr(comment, 'id');
    if (id === undefined) continue;
    const text = children(comment)
      .filter(child => is(child, 'p'))
      .map(paragraphText)
      .join('\n');
    annotations.set(id, text);
  }
  return annotations;
}
