import type { Diagnostic, ProgressEvent } from './conversion.js';

/** Minimal resource access needed by output strategies; no ZIP/XML dependency. */
export interface ResourceReader {
  bytes(path: string): Uint8Array | undefined;
  mime(path: string): string;
}

export interface DiagnosticSink {
  report(diagnostic: Diagnostic): void;
}

/** Per-conversion operations passed to modules instead of sharing the parser. */
export interface ConversionContext extends DiagnosticSink {
  warn(code: string, message: string): void;
  checkAbort(): void;
  progress(event: ProgressEvent): void;
}

export type RenderContext = Pick<ConversionContext, 'warn' | 'checkAbort'>;
