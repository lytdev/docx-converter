import { expect, it } from 'vitest';
import { convertToHtml, convertToJson, renderJsonToHtml } from '../../src/index';
import { docx, image, mt, p, png, R, text } from '../fixtures/docx';

it('restores the same HTML from the serialized document model', async () => {
  const input = docx([
    p(text('前文 ') + `<m:oMath>${mt('x')}</m:oMath>` + text(' 后文')),
    p(`<m:oMathPara><m:oMath>${mt('y')}</m:oMath></m:oMathPara>`),
    p(image()),
    p(text('图 1 还原测试')),
    `<w:tbl><w:tr><w:tc>${p(text('单元格'))}</w:tc></w:tr></w:tbl>`,
  ].join(''), {
    rels: `<Relationship Id="image1" Type="${R}/image" Target="media/a.png"/>`,
    media: { 'a.png': png },
  });
  const options = { output: 'fragment' as const, generatedImageOutput: 'svg' as const };
  const [html, json] = await Promise.all([
    convertToHtml(input, options),
    convertToJson(input, options),
  ]);

  const restored = await renderJsonToHtml(JSON.parse(JSON.stringify(json.document)), options);
  expect(restored).toBe(html.html);
  expect(restored).toContain('formula-item formula-image image-inline');
  expect(restored).toContain('formula-item formula-image image-block');
  expect(restored).toContain('alt="图 1 还原测试"');
  expect(restored).toContain('<td');
});
