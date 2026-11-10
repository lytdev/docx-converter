# DOCX 导出 JSON 后接入 Tiptap

`convertToJson` 现在先调用 `convertToHtml`，再把转换后的 HTML 投影为 JSON 元素树。JSON 不再维护另一套段落、表格和图片语义模型，因此同一份转换结果可以直接按 HTML 标签映射到 Tiptap 或其他编辑器。

完整且可直接解析的 JSON 示例见 [full-test-json-samples.md](full-test-json-samples.md)。

## 1. 返回结构

```ts
const result = await convertToJson(file, {
  output: 'fragment',
  formulaOutput: 'image',
  generatedImageOutput: 'png',
});
```

```ts
interface JsonConversionResult {
  meta: {
    title: string;
    page?: {
      size?: { width?: string; height?: string };
      orientation?: 'portrait' | 'landscape';
      margin?: Record<string, string>;
    };
    theme?: {
      name?: string;
      colors: Record<string, string>;
      fonts: {
        major: Record<string, string>;
        minor: Record<string, string>;
      };
    };
    [name: string]: unknown;
  };
  elements: HtmlJsonNode[];
}
```

`elements` 对应转换后 `<article class="docx-document">` 的子元素。HTML 包装层本身不会作为节点输出。返回值不再包含 `document`、`warnings`、`resources` 或 `stats` 外层字段。

`meta.title`、`subject`、`creator`、`keywords`、`created`、`modified`、`revision` 等核心属性来自 `docProps/core.xml`，其中 `options.title` 优先。`meta.page` 来自 Word 页面设置，尺寸和页边距使用 `pt`；`meta.theme` 来自主题部件，包含颜色方案及 major/minor 字体。

## 2. 节点结构

```ts
interface HtmlJsonNode {
  tag: string;
  id: string;
  text: string;
  class: string[];
  style: Record<string, string>;
  attribute: Record<string, string>;
  children: HtmlJsonNode[];

  title?: string;
  hidden?: string;
  contenteditable?: string;
  src?: string;
  href?: string;
  alt?: string;
  rowspan?: string;
  colspan?: string;
  [name: string]: unknown;
}
```

字段规则：

| 字段 | 规则 |
| --- | --- |
| `tag` | HTML 标签名，统一为小写 |
| `id` | 保留原 `id`；不存在时生成 UUID |
| `text` | 元素完整文本内容 |
| `class` | 原 `class` 按空白拆分后的数组 |
| `style` | 内联样式拆分后的对象，键统一为小写 |
| `attribute` | `data-*`、`aria-*` 和未知扩展属性 |
| `children` | 直接子元素，递归使用相同结构 |

标准属性和元素特有属性直接放在节点根对象，例如：

```json
{
  "tag": "img",
  "id": "8e65f4d1-4f7f-4f20-8605-3c29d630495d",
  "text": "",
  "class": ["formula-item", "formula-image", "image-inline"],
  "style": {
    "max-width": "100%",
    "width": "1.689ex",
    "height": "1.062ex"
  },
  "src": "data:image/svg+xml;base64,...",
  "alt": "图片说明",
  "attribute": {
    "data-type": "formula",
    "data-latex": "x"
  },
  "children": []
}
```

`hidden` 这类布尔属性按解析器读取到的属性值保存。例如 HTML 中的 `<p hidden>` 会得到 `"hidden": "hidden"`。

## 3. 样式示例

```html
<p class="lead highlighted" style="color:red;font-size:12pt" data-type="note">
  正文
</p>
```

```json
{
  "tag": "p",
  "id": "生成或原有 id",
  "text": "正文",
  "class": ["lead", "highlighted"],
  "style": {
    "color": "red",
    "font-size": "12pt"
  },
  "attribute": {
    "data-type": "note"
  },
  "children": []
}
```

样式解析会保留括号和引号内的分号，因此 `url("data:image/svg+xml;base64,...")` 不会被错误拆成多条样式。

## 4. 表格

表格直接使用 HTML 层级：

```text
table
  colgroup
  thead / tbody
    tr
      td / th
        p / img / ...
```

`rowspan`、`colspan` 是节点根属性：

```json
{
  "tag": "td",
  "id": "cell-id",
  "text": "合并单元格",
  "class": [],
  "style": { "padding": "4pt 5pt" },
  "rowspan": "2",
  "colspan": "2",
  "attribute": {},
  "children": []
}
```

Tiptap 映射时应递归处理 `children`，不能只读取当前节点的 `text`。

## 5. 图片和公式

图片使用 `img` 节点：

- `src`：Base64 或外部图片 URL。
- `alt`：替代文本。
- `style.width`、`style.height`：显示尺寸。
- `attribute.data-type`：普通图片为 `image`。

公式有两种形式：

- `formulaOutput: 'image'`：输出 `img`，带 `data-type="formula"` 和 `data-latex`。
- `formulaOutput: 'mathml'`：输出 `span.formula-item > math > ...` 的 MathML 元素树。

```json
{
  "tag": "img",
  "id": "formula-id",
  "text": "",
  "class": ["formula-item", "formula-image", "image-block"],
  "style": { "display": "block" },
  "src": "data:image/svg+xml;base64,...",
  "alt": "\\frac{x}{2}",
  "attribute": {
    "data-type": "formula",
    "data-latex": "\\frac{x}{2}"
  },
  "children": []
}
```

## 6. 批注映射

批注节点使用普通 `span`，通过 `attribute` 区分：

```json
{
  "tag": "span",
  "id": "annotation-id",
  "text": "中国式现代化",
  "class": ["annotation-item"],
  "style": {
    "font-family": "\"宋体\"",
    "font-size": "12pt"
  },
  "attribute": {
    "data-type": "annotation",
    "data-annotation": "中国式现代化的批注"
  },
  "children": []
}
```

识别条件：

```ts
const isAnnotation =
  node.tag === 'span' && node.attribute['data-type'] === 'annotation';
```

接入规则：

- `attribute['data-annotation']` 是批注正文，`class` 包含 `annotation-item`。
- 普通文本批注会把字体、字号等样式合并在同一节点，此时 `children` 通常为空。
- 批注范围覆盖公式、图片等已有 `data-type` 的节点时，外层批注节点会保留 `children`，必须递归映射。
- 多个重叠批注可能形成嵌套 `span`，不要只取最外层 `text` 后丢弃内部节点。
- 光标位置没有选中文字的零长度批注不会出现在 JSON 中。
- 批注作者、时间、回复和已解决状态当前不会输出。

如果业务只处理文字批注，可以映射成 Tiptap 自定义 mark：

```ts
import { Mark, mergeAttributes } from '@tiptap/core';

const Annotation = Mark.create({
  name: 'annotation',

  addAttributes() {
    return {
      annotation: { default: '' },
    };
  },

  parseHTML() {
    return [{
      tag: 'span[data-type="annotation"]',
      getAttrs: element => ({
        annotation: element.getAttribute('data-annotation') ?? '',
      }),
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      class: 'annotation-item',
      'data-type': 'annotation',
    }), 0];
  },
});
```

如果批注需要覆盖公式、图片或任意嵌套行内节点，建议使用自定义 inline node 或原始节点包装器，比 mark 更能保留完整层级。

## 7. 脚注映射

脚注引用使用 `sup` 节点：

```json
{
  "tag": "sup",
  "id": "footnote-id",
  "text": "1",
  "class": [],
  "style": {},
  "attribute": {
    "data-type": "footnote",
    "data-footnote": "脚注的文本"
  },
  "children": []
}
```

识别条件：

```ts
const isFootnote =
  node.tag === 'sup' && node.attribute['data-type'] === 'footnote';
```

映射建议：

- `text` 是文档中显示的编号，可能是 `1`、`2`，也可能是 `①`、`②`。
- `attribute['data-footnote']` 是脚注正文。
- 建议映射为不可编辑的 inline atom node，并保留编号和正文两个 attrs。
- 可通过 NodeView 在 hover、focus 或点击时展示脚注正文。
- 转换结果不包含页面底部的脚注区域，因此编辑器也不应假设存在对应脚注段落。

示例 Tiptap 节点：

```ts
import { Node } from '@tiptap/core';

const Footnote = Node.create({
  name: 'footnote',
  inline: true,
  group: 'inline',
  atom: true,

  addAttributes() {
    return {
      number: { default: '' },
      content: { default: '' },
    };
  },

  parseHTML() {
    return [{
      tag: 'sup[data-type="footnote"]',
      getAttrs: element => ({
        number: element.textContent ?? '',
        content: element.getAttribute('data-footnote') ?? '',
      }),
    }];
  },

  renderHTML({ node }) {
    return ['sup', {
      'data-type': 'footnote',
      'data-footnote': node.attrs.content,
    }, node.attrs.number];
  },
});
```

## 8. Tiptap 映射建议

1. 先判断 `tag`。
2. `p`、`h1` 到 `h6`、`blockquote` 映射为对应 block 节点。
3. `span` 先判断 `attribute['data-type'] === 'annotation'`，再按普通样式文本处理。
4. `sup` 先判断 `attribute['data-type'] === 'footnote'`。
5. `span` 的 `text` 映射为文本节点，`style` 映射为 `textStyle` mark。
6. `strong`、`em`、`u`、`s`、`a` 映射为对应 mark。
7. `table`、`tbody`、`tr`、`td` 递归映射，保留 `rowspan`、`colspan` 和 `style`。
8. `img` 根据 `attribute.data-type === 'formula'` 决定使用图片节点还是公式图片节点。
9. `math` 子树可按自定义 MathML 节点保留，或使用 `data-latex` 映射为公式节点。
10. `attribute` 中的 `data-*` 原样传给自定义节点的 attrs。

`text` 是元素完整文本，不代表文本节点的完整顺序。有 `children` 时应优先递归映射 `children`；叶子元素才直接使用 `text`。

## 9. 从 JSON 还原 HTML

```ts
import { renderJsonToHtml } from '@agilehub/docx-converter';

const result = await convertToJson(file, { output: 'fragment' });
const html = await renderJsonToHtml(result, { output: 'fragment' });
```

还原时会重新输出：

- `tag`
- `id`
- `class`
- `style`
- 标准根属性
- `attribute` 中的扩展属性
- 递归的 `children`

没有子元素时使用 `text` 作为文本内容。JSON 中自动生成的 UUID 也会写成 `id`。

## 10. HTML / JSON 一致性校验

`convertToJson` 直接消费本次 `convertToHtml` 的输出，因此两边共享同一份文档结构、文本、class、style、标准属性和扩展属性。

需要比较 `convertToHtml` 与 JSON 还原后的 HTML 时：

1. 使用相同的 DOCX 和相同转换选项。
2. 忽略自动生成的 `id`。JSON 节点始终需要 `id`，但源 HTML 中不一定存在对应的 `id`。
3. 比较标签层级、文本、class 数组、style 对象、标准属性和 `attribute`，不要按序列化后的属性顺序或 HTML 字符串直接比较。

仓库提供了一致性校验脚本：

```sh
npm run check:html-json -- input.docx report.json
```

报告包含：

- `metaMatch`：HTML 的 `data-docx-meta` 与 JSON `meta`
- `structureMatch`：原始 HTML DOM 与 JSON `elements`
- `restoredMatch`：原始 HTML DOM 与 `renderJsonToHtml` 结果
- `differences`：最多列出 100 个具体节点差异

比较时固定忽略 `id`，报告中会明确记录 `"ignoredAttributes": ["id"]`。

## 11. 注意事项

- `convertToJson` 内部只执行一次 HTML 转换，图片上传和公式生成回调不会因为二次解析重复执行。
- `output` 和 `title` 影响 HTML 包装；JSON 始终只提取正文元素。
- JSON 只保留文档元数据和元素树；警告、资源和统计请使用 `convertToHtml` 获取。
- `MISSING_FOOTNOTE` 等诊断只出现在 `convertToHtml().warnings`，`convertToJson` 当前不会暴露它们。
- 每次 `convertToJson` 都会生成新的节点 `id`，不能把自动 UUID 当作跨转换稳定的业务标识。
- HTML 到 JSON 的转换不保留 text node 的独立顺序信息，因此混合内容应以 `children` 中可映射的元素为主。
- 批注和脚注信息位于 `attribute` 中，不要只读取 `text`；脚注编号使用 `text`，脚注正文使用 `attribute['data-footnote']`。
- 仅在光标位置插入、没有选中内容的批注不会出现在 JSON 中。
- 分别调用 `convertToHtml` 和 `convertToJson` 时，如果 `imageHandler` 返回外部 URL，应确保两次调用得到相同 URL 或只比较同一次 JSON 的还原结果。
- 如果业务只依赖旧版 `DocumentModel`，需要显式保留旧版转换逻辑或迁移到新的 `HtmlJsonNode` 结构。
