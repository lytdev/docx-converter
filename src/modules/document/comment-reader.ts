import { attr, descendants } from '../../infrastructure/xml/dom.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';
import { noteParagraphText } from './note-text.js';

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
    const text = noteParagraphText(comment);
    annotations.set(id, text);
  }
  return annotations;
}
