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

`convertToJson` 先执行本次 HTML 转换，再把 `<article class="docx-document">` 内的元素递归解析为 JSON。返回值是一个 `{ meta, elements }` 对象，`result.elements` 是顶层 HTML 元素数组。

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

批注范围对应 `span` 节点，class 包含 `annotation-item`，`attribute` 中包含 `data-type: "annotation"` 和 `data-annotation`：

```json
{
  "tag": "span",
  "text": "中国式现代化",
  "class": ["annotation-item"],
  "attribute": {
    "data-type": "annotation",
    "data-annotation": "中国式现代化的批注"
  }
}
```

脚注引用对应 `sup` 节点，`text` 是显示编号，`attribute` 中包含脚注正文：

```json
{
  "tag": "sup",
  "text": "1",
  "class": [],
  "attribute": {
    "data-type": "footnote",
    "data-footnote": "脚注的文本"
  }
}
```

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
