/** Stable package facade. Internal modules are not public deep imports. */
export { convertToHtml, convertToJson } from './application/convert-docx.js';
export { convertToPdf } from './application/convert-pdf.js';
export type { JsonConversionResult, DocumentModel, Block, Inline, Paragraph, Table, Cell, Row, TextNode, ImageNode, MathNode, LinkNode, RunStyle, ParaStyle, Css } from './application/convert-docx.js';
export * from './contracts/conversion.js';
export { DocxError } from './contracts/errors.js';
