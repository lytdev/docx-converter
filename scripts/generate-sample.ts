import { mkdir, writeFile } from 'node:fs/promises';
import { sampleDocx } from '../tests/fixtures/docx.ts';
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/sample.docx', import.meta.url), sampleDocx());
console.log('Generated public/sample.docx');
