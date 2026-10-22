import type { ConversionResult } from '../../contracts/conversion.js';
import type { ConversionContext } from '../../contracts/ports.js';
import type { DocumentModel } from '../../domain/document.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';
import type { Styles } from '../styles/style-resolver.js';
import type { Numbering } from '../numbering/numbering-reader.js';

/** Shared only inside the parsing subsystem, never exposed to the renderer. */
export interface ParseContext {
  source: PartReader;
  operations: ConversionContext;
  styles: Styles;
  numbering: Numbering;
  stats: ConversionResult['stats'];
  resources: Set<string>;
}

export interface ParsedDocument {
  document: DocumentModel;
  stats: ConversionResult['stats'];
  resourcePaths: string[];
}
