import type { Document } from '@xmldom/xmldom';
import type { ResourceReader } from '../../contracts/ports.js';

export interface Relationship { target: string; type: string; external: boolean; }

/** Read-only OPC access for OOXML modules; the backing archive is replaceable. */
export interface PartReader extends ResourceReader {
  readonly main: string;
  xml(path: string, required?: boolean): Document | undefined;
  resolve(source: string, target: string): string;
  relationships(source: string): Map<string, Relationship>;
  related(source: string, kind: string): string | undefined;
}
