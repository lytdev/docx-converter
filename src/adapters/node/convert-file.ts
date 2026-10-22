import { readFile, stat } from 'node:fs/promises';
import { convertDocx } from '../../application/convert-docx.js';
import { DEFAULT_LIMITS } from '../../application/limits.js';
import { DocxError } from '../../contracts/errors.js';
import type { ConversionOptions, ConversionResult } from '../../contracts/conversion.js';
/** Node-only file convenience entry. Does not write files or invoke external applications. */
export async function convertDocxFile(path: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  const info = await stat(path);
  if (info.size > (options.limits?.inputBytes ?? DEFAULT_LIMITS.inputBytes)) throw new DocxError('INPUT_LIMIT', '输入文件超过大小限制');
  return convertDocx(await readFile(path), options);
}
