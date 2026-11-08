import { DOMParser } from '@xmldom/xmldom';
import type { Element } from '@xmldom/xmldom';
import type { ConversionOptions } from '../../contracts/conversion.js';
import { esc } from '../../shared/markup.js';
import { renderDocument } from '../html/document-shell.js';

export interface HtmlJsonNode {
  tag: string;
  id: string;
  text: string;
  class: string[];
  style: Record<string, string>;
  attribute: Record<string, string>;
  children: HtmlJsonNode[];
  title?: string;
  hidden?: string;
  contenteditable?: string;
  src?: string;
  href?: string;
  alt?: string;
  rowspan?: string;
  colspan?: string;
  width?: string;
  height?: string;
  target?: string;
  rel?: string;
  [name: string]: unknown;
}

export interface HtmlJsonDocument {
  meta: {
    title: string;
    [name: string]: unknown;
  };
  elements: HtmlJsonNode[];
}

const GLOBAL_ATTRIBUTES = new Set([
  'accesskey', 'autocapitalize', 'autofocus', 'contenteditable', 'dir', 'draggable',
  'enterkeyhint', 'exportparts', 'hidden', 'inert', 'inputmode', 'is', 'itemid',
  'itemprop', 'itemref', 'itemscope', 'itemtype', 'lang', 'nonce', 'part', 'popover',
  'role', 'slot', 'spellcheck', 'tabindex', 'title', 'translate',
]);

const ELEMENT_ATTRIBUTES = new Set([
  'abbr', 'accept', 'accept-charset', 'action', 'allow', 'alt', 'as', 'async',
  'autocomplete', 'autoplay', 'capture', 'checked', 'cite', 'cols', 'colspan',
  'content', 'controls', 'coords', 'crossorigin', 'datetime', 'decoding', 'default',
  'defer', 'disabled', 'download', 'enctype', 'face', 'for', 'form', 'formaction',
  'formenctype', 'formmethod', 'formnovalidate', 'formtarget', 'headers', 'height',
  'high', 'href', 'hreflang', 'http-equiv', 'ismap', 'kind', 'label', 'list', 'loading',
  'loop', 'low', 'max', 'maxlength', 'media', 'method', 'min', 'minlength', 'multiple',
  'muted', 'name', 'novalidate', 'open', 'optimum', 'pattern', 'ping', 'placeholder',
  'playsinline', 'poster', 'preload', 'readonly', 'referrerpolicy', 'rel', 'required',
  'reversed', 'rows', 'rowspan', 'sandbox', 'scope', 'selected', 'shape', 'size', 'sizes',
  'span', 'src', 'srcdoc', 'srclang', 'srcset', 'start', 'step', 'target', 'type',
  'usemap', 'value', 'width', 'wrap',
]);

const MATHML_ATTRIBUTES = new Set([
  'accent', 'accentunder', 'align', 'annotation', 'columnalign', 'columnlines',
  'columnspacing', 'columnwidth', 'denomalign', 'depth', 'display', 'displaystyle',
  'encoding', 'equalcolumns', 'equalrows', 'fence', 'form', 'frame', 'framespacing',
  'height', 'largeop', 'linethickness', 'lspace', 'mathbackground', 'mathcolor',
  'mathsize', 'mathvariant', 'maxsize', 'minlabelspacing', 'minsize', 'movablelimits',
  'notation', 'numalign', 'rowalign', 'rowlines', 'rowspacing', 'rspace', 'scriptlevel',
  'selection', 'separator', 'separators', 'side', 'stretchy', 'symmetric', 'width',
  'xmlns',
]);

const SVG_ATTRIBUTES = new Set([
  'clip-path', 'clip-rule', 'cx', 'cy', 'd', 'fill', 'fill-opacity', 'fill-rule',
  'font-family', 'font-size', 'font-weight', 'gradienttransform', 'gradientunits',
  'marker-end', 'marker-mid', 'marker-start', 'offset', 'opacity', 'points',
  'preserveaspectratio', 'r', 'rx', 'ry', 'stop-color', 'stop-opacity', 'stroke',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
  'stroke-opacity', 'stroke-width', 'text-anchor', 'transform', 'viewbox', 'x', 'x1',
  'x2', 'y', 'y1', 'y2',
]);

const SPECIAL_ATTRIBUTES = new Set(['id', 'class', 'style']);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function childElements(element: Element): Element[] {
  const result: Element[] = [];
  for (let child = element.firstChild; child; child = child.nextSibling)
    if (child.nodeType === 1) result.push(child as Element);
  return result;
}

function splitClass(value: string | null): string[] {
  return value ? value.trim().split(/\s+/).filter(Boolean) : [];
}

function splitStyleDeclarations(value: string): string[] {
  const result: string[] = [];
  let start = 0, quote = '', depth = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')' && depth > 0) depth--;
    else if (char === ';' && depth === 0) {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  result.push(value.slice(start));
  return result;
}

function declarationColon(value: string): number {
  let quote = '', depth = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')' && depth > 0) depth--;
    else if (char === ':' && depth === 0) return index;
  }
  return -1;
}

export function parseInlineStyle(value: string | null): Record<string, string> {
  const style: Record<string, string> = {};
  if (!value) return style;
  for (const declaration of splitStyleDeclarations(value)) {
    const colon = declarationColon(declaration);
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const propertyValue = declaration.slice(colon + 1).trim();
    if (name && propertyValue) style[name] = propertyValue;
  }
  return style;
}

function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = bytes[6] & 0x0f | 0x40;
  bytes[8] = bytes[8] & 0x3f | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isRootAttribute(name: string): boolean {
  return GLOBAL_ATTRIBUTES.has(name) || ELEMENT_ATTRIBUTES.has(name) || MATHML_ATTRIBUTES.has(name) || SVG_ATTRIBUTES.has(name);
}

/** Parses converter HTML into a JSON-safe element tree. Text is the element's full text content. */
export class JsonRenderer {
  render(html: string, title = ''): HtmlJsonDocument {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const body = document.getElementsByTagName('body')[0];
    let roots = body ? childElements(body) : document.documentElement ? [document.documentElement] : [];
    if (!body && roots.length === 1 && roots[0].tagName.toLowerCase() === 'html') {
      const bodyElement = roots[0].getElementsByTagName('body')[0];
      roots = bodyElement ? childElements(bodyElement) : childElements(roots[0]);
    }
    let metadata: Record<string, unknown> = {};
    if (roots.length === 1 && roots[0].tagName.toLowerCase() === 'article'
      && splitClass(roots[0].getAttribute('class')).includes('docx-document')) {
      const serialized = roots[0].getAttribute('data-docx-meta');
      if (serialized) {
        try {
          const parsed = JSON.parse(serialized) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
        } catch {
          // Malformed metadata must not prevent the document elements from being converted.
        }
      }
      roots = childElements(roots[0]);
    }
    const coreTitle = typeof metadata.title === 'string' ? metadata.title : '';
    return { meta: { ...metadata, title: title || coreTitle }, elements: roots.map(element => this.element(element)) };
  }

  private element(element: Element): HtmlJsonNode {
    const node: HtmlJsonNode = {
      tag: (element.localName || element.tagName).toLowerCase(),
      id: element.getAttribute('id') || createId(),
      text: element.textContent ?? '',
      class: splitClass(element.getAttribute('class')),
      style: parseInlineStyle(element.getAttribute('style')),
      attribute: {},
      children: [],
    };
    for (let index = 0; index < element.attributes.length; index++) {
      const attribute = element.attributes.item(index);
      if (!attribute) continue;
      const name = attribute.name.toLowerCase();
      if (SPECIAL_ATTRIBUTES.has(name)) continue;
      if (isRootAttribute(name)) node[name] = attribute.value;
      else node.attribute[name] = attribute.value;
    }
    node.children = childElements(element).map(child => this.element(child));
    return node;
  }
}

function styleText(style: Record<string, string>): string {
  return Object.entries(style).map(([name, value]) => `${name}:${value}`).join(';');
}

function serializeNode(node: HtmlJsonNode): string {
  const tag = node.tag.toLowerCase();
  if (!/^[a-z][a-z0-9:-]*$/i.test(tag)) return esc(node.text);
  const values: Record<string, string> = { ...node.attribute };
  for (const [name, value] of Object.entries(node)) {
    if (['tag', 'text', 'class', 'style', 'attribute', 'children', 'id'].includes(name)) continue;
    if (typeof value === 'string' && isRootAttribute(name)) values[name] = value;
  }
  if (node.id) values.id = node.id;
  if (node.class.length) values.class = node.class.join(' ');
  const inlineStyle = styleText(node.style);
  if (inlineStyle) values.style = inlineStyle;
  const attributes = Object.entries(values)
    .filter(([name]) => /^[a-z_:][a-z0-9_.:-]*$/i.test(name))
    .map(([name, value]) => ` ${name}="${esc(String(value))}"`)
    .join('');
  const opening = `<${tag}${attributes}>`;
  if (VOID_TAGS.has(tag)) return opening;
  const content = node.children.length
    ? node.children.map(child => serializeNode(child)).join('')
    : esc(node.text);
  return `${opening}${content}</${tag}>`;
}

/** Serializes the HTML JSON tree back to the same document/fragment shape used by convertToHtml. */
export function serializeJsonToHtml(document: HtmlJsonDocument, options: ConversionOptions): string {
  return renderDocument(document.elements.map(node => serializeNode(node)).join(''), {
    ...options,
    ...(options.title === undefined && document.meta.title ? { title: document.meta.title } : {}),
  }, document.meta);
}
