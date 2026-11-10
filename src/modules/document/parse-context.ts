import type { ConversionResult } from '../../contracts/conversion.js';
import type { ConversionContext } from '../../contracts/ports.js';
import type { DocumentMetadata, DocumentModel } from '../../domain/document.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';
import type { Styles } from '../styles/style-resolver.js';
import type { Numbering } from '../numbering/numbering-reader.js';
import type { FootnoteDefinitions } from './footnote-reader.js';

/** Shared only inside the parsing subsystem, never exposed to the renderer. */
export interface ParseContext {
  source: PartReader;
  operations: ConversionContext;
  styles: Styles;
  numbering: Numbering;
  annotations: ReadonlyMap<string, string>;
  footnotes: FootnoteDefinitions;
  stats: ConversionResult['stats'];
  resources: Set<string>;
}

export interface ParsedDocument {
  document: DocumentModel;
  metadata: DocumentMetadata;
  stats: ConversionResult['stats'];
  resourcePaths: string[];
}
