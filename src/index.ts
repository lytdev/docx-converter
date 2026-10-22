/** Stable package facade. Internal modules are not public deep imports. */
export { convertDocx } from './application/convert-docx.js';
export * from './contracts/conversion.js';
export { DocxError } from './contracts/errors.js';
