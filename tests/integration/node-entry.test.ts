import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as nodeApi from '../../src/node';

describe('Node file-path API', () => {
  it('exports matching HTML/JSON file helpers with the same options and results as the public byte API', async () => {
    const path = resolve('public/sample.docx');
    const options = { formulaOutput: 'mathml' as const };
    const [html, json] = await Promise.all([
      nodeApi.convertToHtmlFile(path, options),
      nodeApi.convertToJsonFile(path, options),
    ]);
    expect(html.html).toContain('<!DOCTYPE html>');
    expect(json.elements.length).toBeGreaterThan(0);
    expect('convertDocxFile' in nodeApi).toBe(false);
  });

  it('applies the same input size guard to both file helpers', async () => {
    const path = resolve('public/sample.docx');
    await expect(nodeApi.convertToHtmlFile(path, { limits: { inputBytes: 0 } })).rejects.toMatchObject({ code: 'INPUT_LIMIT' });
    await expect(nodeApi.convertToJsonFile(path, { limits: { inputBytes: 0 } })).rejects.toMatchObject({ code: 'INPUT_LIMIT' });
  });
});
