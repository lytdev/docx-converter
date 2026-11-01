import { readFile, stat } from 'node:fs/promises';
import { convertToHtml, convertToJson } from '../../application/convert-docx.js';
import type { JsonConversionResult } from '../../application/convert-docx.js';
import { DEFAULT_LIMITS } from '../../application/limits.js';
import { DocxError } from '../../contracts/errors.js';
import type { ConversionOptions, ConversionResult } from '../../contracts/conversion.js';
import type { PdfConversionOptions, PdfConversionResult } from '../../contracts/conversion.js';
import { convertToPdf } from '../../application/convert-pdf.js';
/** Node-only file convenience entries. They share options with the byte/Blob APIs. */
async function readDocxFile(path: string, options: ConversionOptions): Promise<Uint8Array> {
  const info = await stat(path);
  if (info.size > (options.limits?.inputBytes ?? DEFAULT_LIMITS.inputBytes)) throw new DocxError('INPUT_LIMIT', '输入文件超过大小限制');
  return readFile(path);
}

export async function convertToHtmlFile(path: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  return convertToHtml(await readDocxFile(path, options), options);
}

export async function convertToJsonFile(path: string, options: ConversionOptions = {}): Promise<JsonConversionResult> {
  return convertToJson(await readDocxFile(path, options), options);
}
export async function convertToPdfFile(path: string, options: PdfConversionOptions = {}): Promise<PdfConversionResult> {
  return convertToPdf(await readDocxFile(path, options), options);
}
