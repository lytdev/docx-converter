import type { Block, ImageNode, Inline, Paragraph, Table } from '../../domain/document.js';

const plain = (items: Inline[]): string => items.map(n => n.kind === 'text' ? n.text : n.kind === 'link' ? plain(n.children) : n.kind === 'break' ? '\n' : '').join('');
const allText = (p: Paragraph) => p.children.every(n => n.kind === 'text' || n.kind === 'break' || n.kind === 'link' && n.children.every(c => c.kind === 'text'));
type CaptionMatch =
  | { kind: 'table'; table: Table; caption: Paragraph }
  | { kind: 'figure'; paragraph: Paragraph; image: ImageNode };

/** Pure adjacent-block policy: keep caption recognition separate from HTML construction. */
export function matchCaption(block: Block, next?: Block): CaptionMatch | undefined {
  if (block.kind !== 'paragraph') return;
  if (next?.kind === 'table' && allText(block) && /^\s*表[\s\u3000]*[0-9０-９]/u.test(plain(block.children))) {
    return { kind: 'table', table: next, caption: block };
  }
  if (next?.kind !== 'paragraph' || next.list || !allText(next) || !/^\s*图[\s\u3000]*[0-9０-９]/u.test(plain(next.children))) return;
  const images = block.children.filter((node): node is ImageNode => node.kind === 'image' && !node.formula);
  if (images.length === 1 && block.children.every(node => node === images[0] || node.kind === 'text' && !node.text.trim())) {
    return { kind: 'figure', paragraph: block, image: { ...images[0], alt: plain(next.children).trim() } };
  }
}
