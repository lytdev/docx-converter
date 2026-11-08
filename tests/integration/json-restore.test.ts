import { expect, it } from 'vitest';
import { convertToHtml, convertToJson, renderJsonToHtml } from '../../src/index';
import { docx, image, mt, p, png, R, text } from '../fixtures/docx';

it('restores HTML from the serialized element tree', async () => {
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

  const restored = await renderJsonToHtml(JSON.parse(JSON.stringify(json)), options);
  expect(restored).toContain('<article class="docx-document"');
  expect(restored).toContain('formula-item formula-image image-inline');
  expect(restored).toContain('formula-item formula-image image-block');
  expect(restored).toContain('alt="图 1 还原测试"');
  expect(restored).toContain('<td');
  expect(restored.match(/<img/g)).toHaveLength(html.html.match(/<img/g)?.length ?? 0);
});

it('renders nested elements and separate standard and extension attributes', async () => {
  const html = await renderJsonToHtml({
    meta: { title: '' },
    elements: [{
      tag: 'table',
      id: 'table-1',
      text: '表 1 数据',
      class: ['data-table'],
      style: { border: '1px solid #000' },
      rowspan: '2',
      attribute: { 'data-type': 'table' },
      children: [{
        tag: 'caption',
        id: 'caption-1',
        text: '表 1 数据',
        class: [],
        style: {},
        attribute: {},
        children: [],
      }],
    }],
  }, { output: 'fragment' });

  expect(html).toContain('data-type="table"');
  expect(html).toContain('rowspan="2"');
  expect(html).toContain('id="table-1"');
  expect(html).toContain('class="data-table"');
  expect(html).toContain('style="border:1px solid #000"');
  expect(html).toContain('<caption id="caption-1">表 1 数据</caption>');
});
