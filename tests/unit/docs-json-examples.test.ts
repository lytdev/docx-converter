import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('keeps JSON examples in full-test-json-samples.md parseable', async () => {
  const markdown = await readFile(resolve('docs/full-test-json-samples.md'), 'utf8');
  const blocks = [...markdown.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)].map(match => match[1]);
  expect(blocks.length).toBeGreaterThan(0);
  for (const [index, block] of blocks.entries())
    expect(() => JSON.parse(block), `JSON example ${index + 1}`).not.toThrow();
});
