import { writeFile } from 'node:fs/promises';
import { convertDocxFile, createImageMagickPreviewConverter } from '@agile-hub/docx-html/node';

const input = process.argv[2];
if (!input) throw new Error('Usage: node examples/node.mjs input.docx [output.html]');
const result = await convertDocxFile(input, {
  title: '转换文档',
  ...(process.env.DOCX_MAGICK ? { images: { convert: createImageMagickPreviewConverter(process.env.DOCX_MAGICK) } } : {}),
  onProgress: event => console.log(event.stage, event.completed ?? '', event.total ?? ''),
});
await writeFile(process.argv[3] ?? 'output.html', result.html, 'utf8');
console.log(result.stats);
for (const warning of result.warnings) console.warn(warning.code, warning.message);
