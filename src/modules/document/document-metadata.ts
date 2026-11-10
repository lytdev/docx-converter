import type { DocumentMetadata, DocumentPageMetadata } from '../../domain/document.js';
import { attr, child, children, is, number } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import { pt } from '../../shared/units.js';
import type { Styles } from '../styles/style-resolver.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';

const CORE_PROPERTIES = [
  'title', 'subject', 'creator', 'keywords', 'description', 'lastModifiedBy',
  'created', 'modified', 'category', 'contentStatus', 'version', 'revision',
  'language', 'identifier', 'source', 'rights',
] as const;

function coreProperties(source: PartReader): DocumentMetadata {
  const path = source.related('', 'core-properties');
  const root = path ? source.xml(path)?.documentElement : undefined;
  if (!root) return {};
  const metadata: DocumentMetadata = {};
  const supported = new Set<string>(CORE_PROPERTIES);
  for (const element of children(root)) {
    const name = element.localName;
    if (!name || !supported.has(name)) continue;
    const value = element.textContent?.trim();
    if (value) metadata[name] = value;
  }
  return metadata;
}

function pageMetadata(body: X): DocumentPageMetadata | undefined {
  const sections = children(body).filter(element => is(element, 'sectPr'));
  const section = sections[sections.length - 1];
  if (!section) return;
  const page: DocumentPageMetadata = {};
  const size = child(section, 'pgSz');
  const width = attr(size, 'w'), height = attr(size, 'h');
  if (width !== undefined || height !== undefined) {
    page.size = {
      ...(width !== undefined ? { width: pt(number(width) / 20) } : {}),
      ...(height !== undefined ? { height: pt(number(height) / 20) } : {}),
    };
  }
  const explicitOrientation = attr(size, 'orient');
  if (explicitOrientation === 'portrait' || explicitOrientation === 'landscape') page.orientation = explicitOrientation;
  else if (width !== undefined && height !== undefined) page.orientation = number(width) > number(height) ? 'landscape' : 'portrait';

  const margins = child(section, 'pgMar');
  if (margins) {
    const margin: NonNullable<DocumentPageMetadata['margin']> = {};
    for (const side of ['top', 'right', 'bottom', 'left', 'header', 'footer', 'gutter'] as const) {
      const value = attr(margins, side);
      if (value !== undefined) margin[side] = pt(number(value) / 20);
    }
    if (Object.keys(margin).length) page.margin = margin;
  }
  return Object.keys(page).length ? page : undefined;
}

export function readDocumentMetadata(source: PartReader, body: X, styles: Styles): DocumentMetadata {
  const metadata = coreProperties(source);
  const page = pageMetadata(body);
  if (page) metadata.page = page;
  const theme = styles.documentTheme();
  if (theme.name || Object.keys(theme.colors).length
    || Object.keys(theme.fonts.major).length || Object.keys(theme.fonts.minor).length) metadata.theme = theme;
  return metadata;
}
