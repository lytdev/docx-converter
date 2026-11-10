/** Stable package facade. Internal modules are not public deep imports. */
export { convertToHtml, convertToJson, renderJsonToHtml } from './application/convert-docx.js';
export type { JsonConversionResult, HtmlJsonDocument, HtmlJsonNode, Annotation, DocumentMetadata, DocumentPageMetadata, DocumentThemeMetadata, ThemeFonts, DocumentModel, Block, Inline, Paragraph, Table, Cell, Row, TextNode, ImageNode, MathNode, LinkNode, RunStyle, ParaStyle, Css, HtmlAttributes } from './application/convert-docx.js';
export * from './contracts/conversion.js';
export { DocxError } from './contracts/errors.js';
