import { expect, it } from 'vitest';
import { JsonRenderer, serializeJsonToHtml } from '../../src/rendering/json/json-renderer';

it('projects classes, styles, standard attributes and extension attributes', () => {
  const renderer = new JsonRenderer();
  const result = renderer.render(`<article class="docx-document"><p
    id="note"
    class="lead highlighted"
    style="color: red; background-image: url(&quot;data:image/svg+xml;base64,AA==&quot;); font-size:12pt"
    title="提示"
    hidden
    contenteditable="true"
    data-type="note"
    aria-label="说明"
    custom-value="x"
  ><span>正文</span></p></article>`);

  expect(result.meta).toEqual({ title: '' });
  expect(result.elements).toHaveLength(1);
  expect(result.elements[0]).toMatchObject({
    tag: 'p',
    id: 'note',
    text: '正文',
    class: ['lead', 'highlighted'],
    style: {
      color: 'red',
      'background-image': 'url("data:image/svg+xml;base64,AA==")',
      'font-size': '12pt',
    },
    title: '提示',
    hidden: 'hidden',
    contenteditable: 'true',
    attribute: {
      'data-type': 'note',
      'aria-label': '说明',
      'custom-value': 'x',
    },
  });
  expect(result.elements[0].children[0].id).toMatch(/^[0-9a-f-]{36}$/);
});

it('serializes standard and extension attributes from the JSON tree', () => {
  const html = serializeJsonToHtml({
    meta: { title: '' },
    elements: [{
      tag: 'a',
      id: 'link',
      text: '查看',
      class: ['action'],
      style: { color: 'blue' },
      href: '/detail',
      title: '详情',
      attribute: { 'data-type': 'action' },
      children: [],
    }],
  }, { output: 'fragment' });

  expect(html).toContain('href="/detail"');
  expect(html).toContain('title="详情"');
  expect(html).toContain('data-type="action"');
  expect(html).toContain('class="action"');
  expect(html).toContain('style="color:blue"');
  expect(html).toContain('>查看</a>');
});
