import { expect, it, vi } from 'vitest';
import { convertToHtml, convertToJson } from '../../src/index';
import { docx, image, p, png } from '../fixtures/docx';

it.each([convertToHtml, convertToJson])('uses the 2 KB default boundary and lets callers override it', async convert => {
  const small = new Uint8Array(2048); small.set(png);
  const large = new Uint8Array(2049); large.set(png);
  const input = docx(p(image('small') + image('large')), {
    rels: '<Relationship Id="small" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/small.png"/><Relationship Id="large" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/large.png"/>',
    media: { 'small.png': small, 'large.png': large },
  });
  const upload = vi.fn(async () => ({ fileUrl: '/uploaded.png' }));
  const result = await convert(input, { imageHandler: { processLargeImage: upload } });
  expect(upload).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).toContain('data:image/png;base64,');
  expect(JSON.stringify(result)).toContain('/uploaded.png');
  upload.mockClear();
  const inline = await convert(input, { imageHandler: { base64ImageSize: 4096, processLargeImage: upload } });
  expect(upload).not.toHaveBeenCalled();
  expect(JSON.stringify(inline)).not.toContain('/uploaded.png');
});
