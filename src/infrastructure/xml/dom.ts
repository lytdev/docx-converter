import type { Element } from '@xmldom/xmldom';
import { NS } from './namespaces.js';
export { NS } from './namespaces.js';
export type X = Element;
export function is(el: X, name: string, ns = NS.w): boolean { return el.localName === name && el.namespaceURI === ns; }
export function children(el?: X | null): X[] {
  const out: X[] = [];
  for (let n = el?.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n as X);
  return out;
}
export function child(el: X | undefined | null, name: string, ns = NS.w): X | undefined {
  return children(el).find(e => is(e, name, ns));
}
export function descendants(el: X | undefined | null, name: string, ns = NS.w): X[] {
  if (!el) return [];
  const list = el.getElementsByTagNameNS(ns, name);
  return Array.from({ length: list.length }, (_, i) => list.item(i)!);
}
export function attr(el: X | undefined | null, name: string, ns = NS.w): string | undefined {
  if (!el?.hasAttributeNS(ns, name)) return undefined;
  return el.getAttributeNS(ns, name) ?? undefined;
}
export const val = (el?: X | null): string | undefined => attr(el, 'val');
export function bool(el?: X | null): boolean | undefined {
  if (!el) return undefined;
  return !['0', 'false', 'off', 'none', 'nil'].includes((val(el) ?? 'true').toLowerCase());
}
export function number(value: string | undefined, fallback = 0): number {
  const n = Number(value); return value !== undefined && Number.isFinite(n) ? n : fallback;
}
