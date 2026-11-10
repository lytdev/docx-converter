# 输出格式与结果结构

本文说明 HTML 和 JSON 的返回结构、资源字段及 JSON 还原方式。基础调用和参数见 [README](../README.md)。

## HTML

`convertToHtml`、`convertToHtmlFile` 返回 `ConversionResult`：

```ts
interface ConversionResult {
  html: string;
  warnings: { code: string; message: string; part?: string }[];
  resources: { path: string; mimeType: string; bytes: Uint8Array }[];
  stats: { paragraphs: number; tables: number; images: number; formulas: number };
}
```

| 字段 | 说明 |
| --- | --- |
| `html` | 完整 HTML 页面或正文片段，由 `options.output` 控制。 |
| `warnings` | 内容兼容性提示，例如未支持的公式结构或未包含的文档部件。 |
| `resources` | 被引用的原始图片和 OLE 文件；即使图片无法显示也会保留。 |
| `stats` | 本次转换的段落、表格、图片和公式数量。 |

转换后的 PNG 已嵌入 HTML，不依赖原始 DOCX 或 Blob URL。资源导出功能可按 `resources[].path` 保存原始文件。

`output: 'document'`（默认）返回可直接打开的完整 HTML 页面；`output: 'fragment'` 返回可嵌入现有页面的正文片段。

### 预览到 iframe

```ts
const result = await convertToHtml(file, { title: file.name });
const frame = document.querySelector<HTMLIFrameElement>('#preview')!;

frame.setAttribute('sandbox', '');
frame.srcdoc = result.html;
```

完整 HTML 自带基础样式和内容安全策略。生产环境展示不可信文档时，仍应将预览放在隔离的 sandbox iframe 中。

## JSON

```ts
import { convertToJson, type JsonConversionResult } from '@agilehub/docx-converter';

const result: JsonConversionResult = await convertToJson(file);
JSON.stringify(result, null, 2);
```

### 顶层结构

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
  rowspan?: string;
  [name: string]: unknown;
}

interface JsonConversionResult {
  meta: {
    title: string;
    page?: {
      size?: { width?: string; height?: string };
      orientation?: 'portrait' | 'landscape';
      margin?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
        header?: string;
        footer?: string;
        gutter?: string;
      };
    };
    theme?: {
      name?: string;
      colors: Record<string, string>;
      fonts: {
        major: { latin?: string; eastAsia?: string; bidi?: string };
        minor: { latin?: string; eastAsia?: string; bidi?: string };
      };
    };
    [name: string]: unknown;
  };
  elements: HtmlJsonNode[];
}
```

`convertToJson` 先执行本次 HTML 转换，再把 `<article class="docx-document">` 内的元素递归解析为 JSON。返回值是一个 `{ meta, elements }` 对象，`result.elements` 是顶层 HTML 元素数组。`convertToJsonFile` 的返回结构完全相同。

JSON 是本次 HTML 输出的结构化投影，不是与 HTML 无关的第二套文档模型。因此 HTML 渲染阶段的批注、脚注、图片、公式和样式结果都会直接影响 JSON。

### 元数据

`meta` 会读取 `docProps/core.xml` 中的标题、主题、作者、关键字、描述、创建/修改时间、修订号等核心属性；`options.title` 优先于文档内标题。页面设置从 `sectPr` 提取尺寸、方向和页边距，主题部件提供颜色及 major/minor 字体。长度使用 `pt`，颜色使用十六进制值。

### 节点字段

- `tag`：小写标签名，例如 `p`、`table`、`img`、`math`。
- `id`：保留原 HTML 的 `id`；不存在时生成 UUID。
- `text`：元素的完整文本内容。
- `class`：按空白拆分后的 class 数组。
- `style`：把内联 `style` 拆成属性对象。
- 标准属性：`title`、`hidden`、`contenteditable`、`src`、`href`、`rowspan`、`alt` 等直接放在节点根对象。
- `attribute`：`data-*`、`aria-*` 及未知扩展属性。
- `children`：子元素数组。

例如：

```json
{
  "tag": "p",
  "id": "62e4e831-cfe4-4ce2-bc44-76dbd9bcfe22",
  "text": "示例",
  "class": [],
  "style": { "text-align": "center" },
  "attribute": { "data-type": "note" },
  "children": []
}
```

`formulaOutput: 'image'`（默认）时公式在 JSON 中对应 `img` 节点，`src` 是 PNG/SVG 地址，`data-type="formula"` 和 `data-latex` 位于 `attribute`；设为 `formulaOutput: 'mathml'` 时对应递归的 MathML 元素树。两种形式的完整样例见 [全量 JSON 样例](full-test-json-samples.md)。

批注范围对应 `span` 节点，class 包含 `annotation-item`，`attribute` 中包含 `data-type: "annotation"` 和 `data-annotation`。普通文本批注会把文本样式合并在同一节点：

```json
{
  "tag": "span",
  "id": "annotation-id",
  "text": "中国式现代化",
  "class": ["annotation-item"],
  "style": {
    "font-family": "\"宋体\"",
    "font-size": "12pt",
    "white-space": "pre-wrap"
  },
  "attribute": {
    "data-type": "annotation",
    "data-annotation": "中国式现代化的批注"
  },
  "children": []
}
```

若批注内容自身已有 `data-type`，例如公式或图片，则批注节点保留子节点，需要递归处理：

```json
{
  "tag": "span",
  "id": "annotation-wrapper-id",
  "text": "x",
  "class": ["annotation-item"],
  "style": {},
  "attribute": {
    "data-type": "annotation",
    "data-annotation": "公式批注"
  },
  "children": [
    {
      "tag": "span",
      "id": "formula-wrapper-id",
      "text": "x",
      "class": ["formula-item"],
      "style": {},
      "attribute": {
        "data-type": "formula",
        "data-latex": "x"
      },
      "children": []
    }
  ]
}
```

未选中文字、仅在光标位置插入的零长度批注不会生成节点。批注作者、时间、回复线程同样不在 JSON 中。

脚注引用对应 `sup` 节点，`text` 是显示编号，`attribute` 中包含脚注正文：

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

带圈编号会把 `text` 输出为 `①`、`②` 等。脚注正文可能包含换行；正文缺失时 HTML 转换会产生 `MISSING_FOOTNOTE` 警告，但 JSON 本身不包含诊断信息。

### convertToJson 注意事项

1. **返回字段有限**：`JsonConversionResult` 只有 `meta` 和 `elements`，不包含 `warnings`、`resources`、`stats` 或原始 `html`。需要这些信息时单独调用 `convertToHtml` 或 `convertToHtmlFile`。
2. **每次调用都会重新转换**：`convertToJson` 会重新解压、解析和渲染 DOCX。分别调用 `convertToHtml` 和 `convertToJson` 时，图片上传、公式生成和异步图片回调可能各执行一次。
3. **自动 ID 不稳定**：源 HTML 没有 `id` 时，JSON 会生成 UUID。再次转换同一文件会得到不同 ID，不能把自动 ID 当作数据库主键或跨版本稳定标识。
4. **`text` 不是独立文本节点**：`text` 是当前元素的完整 `textContent`。当元素同时包含直接文本和子元素时，JSON 不会为直接文本单独创建节点；编辑器接入应优先递归 `children`，仅在叶子节点直接使用 `text`。
5. **空文本节点不会保留**：HTML 文本节点没有标签，因此不会被投影为独立 JSON 节点。需要精确还原混合行内顺序时，应以实际生成的元素节点为准。
6. **转换选项仍然生效**：`formulaOutput`、`generatedImageOutput`、`drawingOutput`、`imageHandler`、`limits`、`signal` 和进度回调都会影响 JSON 的内容或执行行为。
7. **`output` 与 `title` 的边界**：`output` 决定内部 HTML 的完整页面或片段包装，JSON 始终只输出正文元素；`title` 优先作为 `meta.title`。
8. **批注和脚注不是普通文本**：批注读取 `attribute['data-annotation']`，脚注正文读取 `attribute['data-footnote']`，脚注显示编号读取 `text`。
9. **零长度批注不输出**：仅有光标位置、没有文字或行内对象被选中的批注当前不会出现在 JSON 中。
10. **JSON 不是编辑器 schema**：`HtmlJsonNode` 接近 HTML 元素树，不是 Tiptap、Slate 或其他编辑器的原生 AST。接入编辑器时需要按 `tag` 和 `attribute['data-type']` 编写映射；Tiptap 示例见 [Tiptap 接入指南](json-tiptap-integration.md)。
11. **错误行为与 HTML 一致**：输入结构错误、资源限制、取消、异步图片回调异常等仍会拒绝 Promise，不会返回部分 JSON。
12. **还原需要 `id`**：`renderJsonToHtml` 会重新输出节点 `id`。跨调用比较 HTML 和 JSON 时应忽略自动生成的 ID。

### JSON 还原 HTML

JSON 文档树可以直接还原为 HTML，不需要原 DOCX 或资源包：

```ts
import { convertToJson, renderJsonToHtml } from '@agilehub/docx-converter';

const result = await convertToJson(file, { output: 'fragment' });
const html = await renderJsonToHtml(result, { output: 'fragment' });
```

还原器会把 `tag`、`class`、`style`、标准属性和 `attribute` 重新序列化为 HTML。JSON 中生成的 UUID 也会作为 `id` 输出。

`convertToJson` 内部只执行一次 HTML 转换，因此图片上传和公式生成不会重复。JSON 只保留文档元数据和元素树；需要警告、资源或统计信息时请调用 `convertToHtml`。分别调用 `convertToHtml` 与 `convertToJson` 时仍是两次独立转换，图片回调会各执行一次。

需要映射到编辑器节点时，见 [Tiptap 接入指南](json-tiptap-integration.md)。

### 下载转换结果

```ts
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const html = await convertToHtml(file);
download(
  new Blob([html.html], { type: 'text/html;charset=utf-8' }),
  'document.html',
);

const json = await convertToJson(file);
download(
  new Blob([JSON.stringify(json, null, 2)], {
    type: 'application/json;charset=utf-8',
  }),
  'document.json',
);
```
