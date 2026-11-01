import { writeFile } from 'node:fs/promises';
import { convertToHtmlFile, convertToJsonFile, createImageMagickPreviewConverter } from '@agile-hub/docx-converter/node';

const input = process.argv[2];
if (!input) throw new Error('Usage: node examples/node.mjs input.docx [output.html|output.json]');
const output = process.argv[3] ?? 'output.html';
const options = {
  title: '转换文档',
  ...(process.env.DOCX_MAGICK ? { imageHandler: { convert: createImageMagickPreviewConverter(process.env.DOCX_MAGICK) } } : {}),
  onProgress: event => console.log(event.stage, event.completed ?? '', event.total ?? ''),
};
const json = output.toLowerCase().endsWith('.json');
const result = json ? await convertToJsonFile(input, options) : await convertToHtmlFile(input, options);
await writeFile(output, json ? JSON.stringify(result, null, 2) : result.html, 'utf8');
console.log(result.stats);
for (const warning of result.warnings) console.warn(warning.code, warning.message);
