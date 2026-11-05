import type { ConversionOptions, ConversionResult, Diagnostic, DocxInput, Resource } from '../contracts/conversion.js';
import type { DocumentModel } from '../domain/document.js';
import { DocxPackage } from '../infrastructure/opc/docx-package.js';
import { DocumentParser } from '../modules/document/document-parser.js';
import { HtmlRenderer } from '../rendering/html/html-renderer.js';
import { JsonRenderer } from '../rendering/json/json-renderer.js';
import { ConversionSession } from './conversion-session.js';
import { resolveLimits } from './limits.js';
import { readInput } from './read-input.js';
import { DocxError } from '../contracts/errors.js';
export type { DocumentModel, Block, Inline, Paragraph, Table, Cell, Row, TextNode, ImageNode, MathNode, LinkNode, RunStyle, ParaStyle, Css } from '../domain/document.js';

/** The JSON result contains only serializable values; resources report metadata, not binary bytes. */
export interface JsonConversionResult {
  document: DocumentModel;
  warnings: Diagnostic[];
  resources: { path: string; mimeType: string; size: number }[];
  stats: ConversionResult['stats'];
}

async function parseDocx(input: DocxInput, options: ConversionOptions) {
  if (options.generatedImageOutput !== undefined && !['png', 'svg'].includes(options.generatedImageOutput))
    throw new DocxError('INVALID_GENERATED_IMAGE_OUTPUT', 'generatedImageOutput 必须为 png 或 svg');
  if (options.drawingOutput !== undefined && !['png', 'svg'].includes(options.drawingOutput))
    throw new DocxError('INVALID_DRAWING_OUTPUT', 'drawingOutput 必须为 png 或 svg');
  const base64ImageSize = options.imageHandler?.base64ImageSize;
  if (base64ImageSize !== undefined && (!Number.isSafeInteger(base64ImageSize) || base64ImageSize < 0))
    throw new DocxError('INVALID_IMAGE_LIMIT', 'base64ImageSize 必须是非负整数（字节）');
  const limits = resolveLimits(options.limits);
  const session = new ConversionSession(options);
  session.checkAbort();
  session.progress({ stage: 'reading' });
  const bytes = await readInput(input, limits.inputBytes, options.signal);

  session.checkAbort();
  session.progress({ stage: 'extracting' });
  const source = new DocxPackage(bytes, limits);
  const context = session.forPart(source.main);
  const parser = new DocumentParser(source, context);

  session.progress({ stage: 'parsing', completed: 0 });
  const parsed = parser.parse();
  session.checkAbort();
  return { source, context, parsed, session };
}

function collectResources(source: DocxPackage, paths: string[]): Resource[] {
  return paths.flatMap(path => {
    const data = source.bytes(path);
    return data ? [{ path, mimeType: source.mime(path), bytes: data }] : [];
  });
}

/** Composition root: both output strategies consume the same parsed document model. */
export async function convertToHtml(input: DocxInput, options: ConversionOptions = {}): Promise<ConversionResult> {
  const { source, context, parsed, session } = await parseDocx(input, options);
  session.progress({ stage: 'rendering' });
  const html = await new HtmlRenderer(source, context, options).render(parsed.document);

  session.checkAbort();
  const resources = collectResources(source, parsed.resourcePaths);
  session.progress({ stage: 'complete' });
  return { html, warnings: session.warnings, resources, stats: parsed.stats };
}

/** Convert DOCX to a serializable document tree using the same options and parser as convertToHtml. */
export async function convertToJson(input: DocxInput, options: ConversionOptions = {}): Promise<JsonConversionResult> {
  const { source, context, parsed, session } = await parseDocx(input, options);
  session.progress({ stage: 'rendering' });
  const document = await new JsonRenderer(source, context, options).render(parsed.document);

  session.checkAbort();
  const resources = collectResources(source, parsed.resourcePaths)
    .map(({ path, mimeType, bytes }) => ({ path, mimeType, size: bytes.byteLength }));
  session.progress({ stage: 'complete' });
  return { document, warnings: session.warnings, resources, stats: parsed.stats };
}
