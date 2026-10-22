import type { ConversionOptions, ConversionResult, DocxInput } from '../contracts/conversion.js';
import { DocxPackage } from '../infrastructure/opc/docx-package.js';
import { DocumentParser } from '../modules/document/document-parser.js';
import { HtmlRenderer } from '../rendering/html/html-renderer.js';
import { ConversionSession } from './conversion-session.js';
import { resolveLimits } from './limits.js';
import { readInput } from './read-input.js';

/** Composition root: wires concrete modules; neither parser nor renderer owns the other. */
export async function convertDocx(input: DocxInput, options: ConversionOptions = {}): Promise<ConversionResult> {
  const limits = resolveLimits(options.limits);
  const session = new ConversionSession(options);
  session.checkAbort();
  session.progress({ stage: 'reading' });
  const bytes = await readInput(input, limits.inputBytes);

  session.checkAbort();
  session.progress({ stage: 'extracting' });
  const source = new DocxPackage(bytes, limits);
  const context = session.forPart(source.main);
  const parser = new DocumentParser(source, context);

  session.progress({ stage: 'parsing', completed: 0 });
  const parsed = parser.parse();
  session.checkAbort();
  session.progress({ stage: 'rendering' });
  const html = await new HtmlRenderer(source, context, options).render(parsed.document);

  session.checkAbort();
  const resources = parsed.resourcePaths.flatMap(path => {
    const data = source.bytes(path);
    return data ? [{ path, mimeType: source.mime(path), bytes: data }] : [];
  });
  session.progress({ stage: 'complete' });
  return { html, warnings: session.warnings, resources, stats: parsed.stats };
}
