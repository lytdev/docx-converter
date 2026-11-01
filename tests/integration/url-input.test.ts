import { afterEach, expect, it, vi } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { docx, p, text } from '../fixtures/docx';
afterEach(() => vi.unstubAllGlobals());

it('downloads URL inputs for both public methods and forwards the abort signal', async () => {
  const bytes = docx(p(text('网络文档')));
  const fetcher = vi.fn(async () => new Response(new Uint8Array(bytes)));
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  expect((await convertToHtml('https://example.com/a.docx', { signal: controller.signal })).html).toContain('网络文档');
  expect(JSON.stringify(await convertToJson('https://example.com/a.docx'))).toContain('网络文档');
  expect(fetcher).toHaveBeenCalledWith('https://example.com/a.docx', { signal: controller.signal });
});

it('rejects HTTP failures, unsupported protocols and oversized streamed responses', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
  await expect(convertToHtml('https://example.com/a')).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  await expect(convertToHtml('file:///a.docx')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(20))));
  await expect(convertToJson('https://example.com/a', { limits: { inputBytes: 10 } })).rejects.toMatchObject({ code: 'INPUT_LIMIT' });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { headers: { 'content-length': '20' } })));
  await expect(convertToHtml('https://example.com/a', { limits: { inputBytes: 10 } })).rejects.toMatchObject({ code: 'INPUT_LIMIT' });
});
