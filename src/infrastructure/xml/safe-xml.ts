import { DOMParser } from '@xmldom/xmldom';
import type { Document } from '@xmldom/xmldom';
import { DocxError } from '../../contracts/errors.js';
import { children } from './dom.js';
import type { X } from './dom.js';
export function parseXml(bytes: Uint8Array, path: string, maxDepth: number): Document {
  let source: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) source = new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) source = new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
  else source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(source)) throw new DocxError('UNSAFE_XML', `禁止 DTD/实体声明：${path}`);
  try {
    const doc = new DOMParser({ onError: level => { throw new Error(`XML ${level}`); } }).parseFromString(source, 'application/xml');
    if (!doc.documentElement) throw new Error('Missing root');
    const stack: [X, number][] = [[doc.documentElement, 1]];
    while (stack.length) {
      const [el, depth] = stack.pop()!;
      if (depth > maxDepth) throw new DocxError('XML_DEPTH', `XML 嵌套过深：${path}`);
      for (const c of children(el)) stack.push([c, depth + 1]);
    }
    return doc;
  } catch (e) {
    if (e instanceof DocxError) throw e;
    throw new DocxError('INVALID_XML', `XML 无法解析：${path}`);
  }
}
