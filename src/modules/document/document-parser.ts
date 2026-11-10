import type { Block, Paragraph } from '../../domain/document.js';
import type { ConversionContext } from '../../contracts/ports.js';
import { DocxError } from '../../contracts/errors.js';
import type { PartReader } from '../../infrastructure/opc/part-reader.js';
import { attr, child, descendants, is } from '../../infrastructure/xml/dom.js';
import type { X } from '../../infrastructure/xml/dom.js';
import { Styles } from '../styles/style-resolver.js';
import { Numbering } from '../numbering/numbering-reader.js';
import type { ParseContext, ParsedDocument } from './parse-context.js';
import { contentElements } from './block-reader.js';
import { parseParagraph } from './paragraph-parser.js';
import { InlineParser } from './inline-parser.js';
import { DrawingParser } from './drawing-parser.js';
import { TableParser } from './table-parser.js';
import { readDocumentMetadata } from './document-metadata.js';
import { readCommentAnnotations } from './comment-reader.js';
import { readFootnotes } from './footnote-reader.js';

/** Coordinates document flow; feature parsers own their own algorithms. */
export class DocumentParser {
  private readonly context: ParseContext;
  private readonly inlines: InlineParser;
  private readonly tables: TableParser;

  constructor(source: PartReader, operations: ConversionContext) {
    this.context = { source, operations, styles: new Styles(source, operations), numbering: new Numbering(source),
      annotations: readCommentAnnotations(source), footnotes: readFootnotes(source),
      stats: { paragraphs: 0, tables: 0, images: 0, formulas: 0 }, resources: new Set() };
    const drawings = new DrawingParser(this.context, parent => contentElements(parent, operations)
      .filter(el => is(el, 'p')).map(el => this.paragraph(el)));
    this.inlines = new InlineParser(this.context, drawings);
    this.tables = new TableParser(this.context, parent => this.blocks(parent));
  }
  parse(): ParsedDocument {
    const body = child(this.context.source.xml(this.context.source.main, true)!.documentElement, 'body');
    if (!body) throw new DocxError('MISSING_BODY', 'DOCX 缺少正文');
    const items = contentElements(body, this.context.operations);
    const blocks: Block[] = [];
    for (let i = 0; i < items.length; i++) {
      this.context.operations.checkAbort();
      const el = items[i];
      if (is(el, 'p')) blocks.push(this.paragraph(el));
      else if (is(el, 'tbl')) blocks.push(this.tables.parse(el));
      this.context.operations.progress({ stage: 'parsing', completed: i + 1, total: items.length });
    }
    for (const r of this.context.source.relationships(this.context.source.main).values()) {
      const kind = ['header', 'footer', 'endnotes'].find(t => r.type.endsWith(`/${t}`));
      if (!kind || (kind === 'endnotes' && !this.hasEndnotes(r.target))) continue;
      this.context.operations.warn('UNSUPPORTED_PART', `当前正文转换不包含 ${kind} 部件`);
    }
    return {
      document: { blocks },
      metadata: readDocumentMetadata(this.context.source, body, this.context.styles),
      stats: { ...this.context.stats },
      resourcePaths: [...this.context.resources],
    };
  }

  private blocks(parent: X): Block[] {
    return contentElements(parent, this.context.operations).map(el => is(el, 'tbl') ? this.tables.parse(el) : this.paragraph(el));
  }
  private paragraph(el: X): Paragraph {
    return parseParagraph(el, this.context, (node, style) => this.inlines.parse(node, style));
  }
  private hasEndnotes(target: string): boolean {
    const path = this.context.source.resolve(this.context.source.main, target);
    const root = this.context.source.xml(path)?.documentElement;
    return descendants(root, 'endnote').some(note => {
      const type = attr(note, 'type');
      return type === undefined || type === 'normal';
    });
  }
}
