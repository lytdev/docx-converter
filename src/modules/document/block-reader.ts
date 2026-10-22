import { child, children, is } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import type { ConversionContext } from '../../contracts/ports.js';
export function contentElements(parent: X | undefined, operations: Pick<ConversionContext, 'warn'>): X[] {
  return children(parent).flatMap(e => {
    if (is(e, 'p') || is(e, 'tbl')) return [e];
    if (is(e, 'sdt')) return contentElements(child(e, 'sdtContent'), operations);
    if (is(e, 'customXml') || is(e, 'ins')) return contentElements(e, operations);
    if (is(e, 'del')) { operations.warn('TRACKED_CHANGES', '修订按接受后的内容显示，删除内容已省略'); return []; }
    if (is(e, 'sectPr') || is(e, 'tcPr')) return [];
    operations.warn('UNSUPPORTED_BLOCK', `未支持的正文结构：${e.localName}`); return [];
  });
}
