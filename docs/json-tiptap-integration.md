# DOCX 导出 JSON 后接入 Tiptap

本文面向需要消费 `@agilehub/docx-converter` JSON 结果的其他项目，说明：

- JSON 顶层结果和 `DocumentModel` 各字段的含义
- JSON 到 Tiptap 节点、mark、表格和列表的映射方式
- 公式、图片、图注和样式的保真处理
- 如何从 JSON 最大程度还原 HTML
- 常见失败场景和精度边界

## 1. 接入选择

有两种接入方式。

### 方式 A：先还原 HTML，再交给 Tiptap 解析

适用于目标项目只需要展示内容，或者已经具备可靠 HTML 粘贴、导入能力。

```ts
import type { Editor } from '@tiptap/core';
import {
  convertToJson,
  renderJsonToHtml,
  type DocumentModel,
  type JsonConversionResult,
} from '@agilehub/docx-converter';
import { convertMetafileImage } from '@agilehub/docx-converter/browser-metafile';

const result: JsonConversionResult = await convertToJson(file, {
  output: 'fragment',
  formulaOutput: 'image',
  generatedImageOutput: 'png',
});

const html = await renderJsonToHtml(result.document, {
  output: 'fragment',
});

editor.commands.insertContent(html);
```

优点：

- 直接复用库的 HTML 渲染逻辑
- 表格、列表、图注、公式图片和 HTML `attributes` 不需要重复实现
- 使用同一份 JSON 时，可以还原为与原始 HTML 一致的字符串

这种方式要求 Tiptap schema 能够识别生成的 HTML。尤其是 `data-type`、图片 class、表格结构和公式图片节点。

### 方式 B：把 JSON 递归映射成 Tiptap JSON

适用于目标项目需要原生 Tiptap 节点、可编辑公式、图片节点视图或自定义表格结构。

这种方式不应解析 HTML DOM，而应直接遍历 `result.document.blocks`。

## 2. 转换入口和选项

```ts
import { convertToJson } from '@agilehub/docx-converter';

const result = await convertToJson(input, {
  formulaOutput: 'image',
  generatedImageOutput: 'png',
  drawingOutput: 'png',
  imageHandler: {
    base64ImageSize: 2 * 1024,
  },
});
```

与 Tiptap 映射最相关的选项：

| 选项 | 默认值 | 对 JSON 的影响 |
| --- | --- | --- |
| `formulaOutput` | `'image'` | `'image'` 时公式节点有 `src`；`'mathml'` 时保留 `mathml` 但不生成公式图片 |
| `generatedImageOutput` | `'png'` | 控制公式和图表图片为 PNG 或 SVG |
| `drawingOutput` | 继承 `generatedImageOutput` | 单独控制 Word 组合图形 |
| `imageHandler` | 内嵌 Base64 | 可把大图转为外部 URL，JSON 的 `src` 会使用回调返回值 |
| `output` | `'document'` | 只影响 HTML 包装，不影响 JSON 文档树 |

建议 HTML 和 JSON 使用完全相同的图片、公式和 `imageHandler` 选项，避免两次独立转换得到不同 `src`。

## 3. 顶层 JSON 结构

`convertToJson` 返回：

```ts
interface JsonConversionResult {
  document: DocumentModel;
  warnings: Diagnostic[];
  resources: {
    path: string;
    mimeType: string;
    size: number;
  }[];
  stats: {
    paragraphs: number;
    tables: number;
    images: number;
    formulas: number;
  };
}

interface DocumentModel {
  blocks: Block[];
}
```

如果 JSON 已保存为文件或字符串，读取后先解析顶层结果：

```ts
import type { JsonConversionResult } from '@agilehub/docx-converter';

const result = JSON.parse(jsonText) as JsonConversionResult;
if (!result.document || !Array.isArray(result.document.blocks)) {
  throw new Error('不是有效的 DOCX 转换 JSON');
}

const document = result.document;
```

说明：

- `document` 是主要接入数据。
- `warnings` 表示降级或未完整支持的内容，不代表转换失败。
- `resources` 只包含资源元数据，不包含 `Uint8Array` 字节。需要原始资源字节时，应保留 DOCX 或使用 `convertToHtml` 返回的资源数据。
- JSON 图片通常已经通过 `src` 内嵌 Base64；使用 `imageHandler` 时也可能是外部 URL。
- `stats` 用于统计，不应作为映射依据。

## 4. DocumentModel 节点

### 4.1 Block

```ts
type Block = Paragraph | Table;
```

每个 Block 都有 `kind` 判别字段，必须使用 `kind` 分支，不要依赖字段是否存在来猜测类型。

### 4.2 Paragraph

```ts
interface Paragraph {
  kind: 'paragraph';
  style: ParaStyle;
  children: Inline[];
  list?: {
    id: string;
    level: number;
    format: string;
    start: number;
    text: string;
  };
}
```

| 字段 | 含义 | Tiptap 映射建议 |
| --- | --- | --- |
| `style.css` | 段落的 CSS 属性对象 | 转为 `inlineStyle` 字符串或样式属性 |
| `style.outline` | `0` 开始的标题级别 | `heading.level = min(6, max(1, outline + 1))` |
| `style.numId` | Word 列表定义 ID | 仅用于诊断或保留来源，不直接作为 Tiptap 节点属性 |
| `style.level` | Word 列表级别 | 与 `list.level` 配合使用 |
| `children` | 行内内容 | 递归映射为 Tiptap inline 节点 |
| `list` | 当前段落属于列表 | 连续且 `list.id` 相同的段落应合成为同一列表 |
| `list.format` | `decimal`、`bullet`、`lowerRoman` 等 | 映射为有序或无序列表以及 `listStyleType` |
| `list.start` | 起始编号 | 有序列表的 `start` |

`style.css` 不是 CSS 字符串，而是：

```ts
type Css = Record<string, string>;
```

例如：

```json
{
  "text-align": "center",
  "margin-bottom": "8pt",
  "font-size": "11pt"
}
```

转为 Tiptap 常用内联样式：

```ts
const cssToStyle = (css: Record<string, string> = {}) =>
  Object.entries(css)
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
```

### 4.3 Inline

```ts
type Inline =
  | TextNode
  | ImageNode
  | MathNode
  | LinkNode
  | { kind: 'break' }
  | { kind: 'anchor'; id: string }
  | { kind: 'unsupported'; label: string };
```

映射时必须先判断 `kind`。图片公式需要先判断 `ImageNode.formula`。

### 4.4 TextNode

```ts
interface TextNode {
  kind: 'text';
  text: string;
  style: RunStyle;
}

interface RunStyle {
  latin?: string;
  eastAsia?: string;
  size?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  background?: string;
  vertical?: string;
}
```

`false` 是有意义的值，不能统一按 falsy 丢弃。例如 `bold: false` 表示显式取消粗体。

| RunStyle | Tiptap mark / attr |
| --- | --- |
| `bold` | `bold` |
| `italic` | `italic` |
| `underline` | `underline` |
| `strike` | `strike` |
| `vertical: superscript` | `superscript` |
| `vertical: subscript` | `subscript` |
| `latin`、`eastAsia` | `textStyle.fontFamily` |
| `size` | `textStyle.fontSize`，数值单位为 pt |
| `color` | `textStyle.color` |
| `background` | `textStyle.backgroundColor` |

### 4.5 ImageNode

```ts
interface ImageNode {
  kind: 'image';
  path?: string;
  alt: string;
  width?: number;
  height?: number;
  formula: boolean;
  latex?: string;
  css: Css;
  src?: string;
  generatedSvg?: string;
  generatedKind?: 'drawing' | 'chart';
  attributes?: Record<string, string>;
}
```

| 字段 | 含义 |
| --- | --- |
| `path` | DOCX 包内原始资源路径，例如 `word/media/image1.png` |
| `alt` | 图片替代文本；图注规则匹配后可能是图注文字 |
| `width/height` | 显示尺寸，单位近似 CSS px |
| `formula` | 是否为旧版 OLE 或 MathType 公式预览 |
| `latex` | 可从 OLE/MTEF 重建时存在 |
| `css` | 图片附加样式 |
| `src` | 最终可显示地址，可能是 Base64 data URL 或外部 URL |
| `generatedSvg` | 组合图形或图表生成的 SVG 源，一般优先使用 `src` |
| `generatedKind` | `drawing` 或 `chart` |
| `attributes` | 对应 HTML `<img>` 的属性映射 |

映射规则：

1. `formula === true`：映射为公式节点，不要映射为普通图片。
2. `formula === false` 且有 `src`：映射为图片节点。
3. 没有 `src`：映射为占位节点，并保留 `alt`、`path` 和 warning 信息。
4. `attributes.class` 可用于还原 HTML，不建议作为判断节点类型的唯一依据。

### 4.6 MathNode

```ts
interface MathNode {
  kind: 'math';
  mathml: string;
  latex?: string;
  display: boolean;
  src?: string;
  attributes?: Record<string, string>;
}
```

| 字段 | 含义 |
| --- | --- |
| `mathml` | 内部重建的 MathML |
| `latex` | 可提取的 LaTeX；不支持的结构可能省略 |
| `display` | `false` 为行内公式，`true` 为独立行公式 |
| `src` | PNG 或 SVG data URL；`formulaOutput: 'mathml'` 时可能没有 |
| `attributes` | 对应 HTML 公式图片或 MathML 容器的属性 |

公式映射：

```ts
const formulaNode = math.display
  ? { type: 'blockMath', attrs: { latex: math.latex ?? '', src: math.src ?? null } }
  : { type: 'inlineMath', attrs: { latex: math.latex ?? '', src: math.src ?? null } };
```

如果目标编辑器只支持 LaTeX，而 `latex` 缺失，应保留 `mathml` 或 `src` 作为降级展示，不要根据图片 OCR 猜测公式。

### 4.7 LinkNode

```ts
interface LinkNode {
  kind: 'link';
  url: string;
  children: Inline[];
}
```

建议对 `children` 递归映射，并给文本节点追加 link mark。不要只取 `children` 的纯文本，否则会丢失链接内部其他样式。

### 4.8 Table

```ts
interface Table {
  kind: 'table';
  rows: Row[];
  css: Css;
  caption?: Paragraph;
}

interface Row {
  cells: Cell[];
  css: Css;
}

interface Cell {
  blocks: Block[];
  colspan: number;
  rowspan: number;
  css: Css;
}
```

表格映射要求：

- `table.css` 映射到 table 样式。
- `row.css` 映射到 tableRow 样式。
- `cell.css` 映射到 tableCell 样式。
- `colspan`、`rowspan` 映射到单元格属性。
- `cell.blocks` 必须递归映射，允许段落、图片、公式、嵌套表格。
- Tiptap 单元格必须有内容；空单元格应补充空 paragraph。
- `table.caption` 存在时可映射到自定义 `tableCaption` 或普通段落。

## 5. 图片和公式的 attributes 字段

图片和公式节点会额外提供：

```ts
attributes?: Record<string, string>;
```

可能包含：

| 属性 | 含义 |
| --- | --- |
| `src` | HTML 图片地址 |
| `alt` | HTML alt |
| `class` | HTML class |
| `data-type` | 当前为 `formula` 或 `image` |
| `data-latex` | 公式 LaTeX |
| `style` | 图片尺寸、垂直对齐等内联样式 |
| `data-resource` | 无法显示图片时的 DOCX 原始路径 |

用途：

- 目标 Tiptap NodeView 的 `renderHTML` 可以直接复用这些属性
- 需要使用 `renderJsonToHtml` 时由库直接消费
- 方便比较 HTML 和 JSON 转换结果

不要把 `attributes.class` 当成语义判别字段。业务映射仍应使用：

- `node.kind`
- `node.formula`
- `node.display`
- `node.latex`
- `node.style`

## 6. 推荐的 Tiptap schema

至少需要以下节点和 mark。名称可按项目约定调整。

| 类型 | 推荐名称 | 必需属性 |
| --- | --- | --- |
| 图片 | `inlineImage`、`image` | `src`、`alt`、`width`、`height`、`inlineStyle` |
| 行内公式 | `inlineMath` | `latex`、`src`、`display: false` |
| 独立行公式 | `blockMath` | `latex`、`src`、`display: true` |
| 表格 | `table`、`tableRow`、`tableCell` | `colspan`、`rowspan`、`inlineStyle` |
| 文本样式 | `textStyle` | 字体、字号、颜色、背景色 |
| 其他 mark | `bold`、`italic`、`underline`、`strike`、`link` | 按目标 schema 定义 |
| 上下标 | `superscript`、`subscript` | 按目标 schema 定义 |

公式图片的 `renderHTML` 建议保留：

```ts
const display = node.attrs.display;

return [
  'img',
  {
    src: node.attrs.src,
    alt: node.attrs.latex || '公式',
    class: `formula-item formula-image image-${display ? 'block' : 'inline'}`,
    'data-type': 'formula',
    'data-latex': node.attrs.latex,
    style: node.attrs.style,
  },
];
```

如果 `formulaOutput: 'mathml'` 且没有 `src`，应使用自定义 MathML 容器或保留公式占位，不要把它当普通图片。

## 7. 递归映射算法

核心原则：

1. 先按 Block 遍历。
2. 连续列表段落按 `list.id` 合并。
3. 普通段落内部按 Inline 遍历。
4. 遇到 Table 时递归处理单元格 blocks。
5. 遇到独立行 MathNode 时，从段落行内内容中拆分成独立 Tiptap block。
6. 单图片段落优先映射为 block image。
7. 文本相邻且样式相同的节点可以合并，但不要求与 HTML span 数量一致。

先定义目标节点结构和文本 mark 辅助函数：

```ts
type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

const normalizeFontFamily = (font: string) =>
  /\s/.test(font) ? `"${font}"` : font;

function createTextMarks(style: RunStyle): TiptapMark[] {
  const marks: TiptapMark[] = [];
  if (style.bold) marks.push({ type: 'bold' });
  if (style.italic) marks.push({ type: 'italic' });
  if (style.underline) marks.push({ type: 'underline' });
  if (style.strike) marks.push({ type: 'strike' });
  if (/superscript|super/i.test(style.vertical ?? ''))
    marks.push({ type: 'superscript' });
  if (/subscript|sub/i.test(style.vertical ?? ''))
    marks.push({ type: 'subscript' });

  const fontFamily = [style.latin, style.eastAsia]
    .filter((font): font is string => Boolean(font))
    .map(normalizeFontFamily)
    .filter((font, index, fonts) => fonts.indexOf(font) === index)
    .join(', ');

  const textStyle = {
    ...(fontFamily ? { fontFamily } : {}),
    ...(style.size ? { fontSize: `${style.size}pt` } : {}),
    ...(style.color ? { color: style.color } : {}),
    ...(style.background ? { backgroundColor: style.background } : {}),
  };

  if (Object.keys(textStyle).length)
    marks.push({ type: 'textStyle', attrs: textStyle });

  return marks;
}
```

### 7.1 行内映射骨架

```ts
function mapInline(node: Inline): TiptapNode[] {
  if (node.kind === 'text') {
    return [{
      type: 'text',
      text: node.text,
      marks: createTextMarks(node.style),
    }];
  }

  if (node.kind === 'link') {
    return node.children.flatMap((child) => {
      const mapped = mapInline(child);
      return mapped.map((item) =>
        item.type === 'text'
          ? {
              ...item,
              marks: [
                ...(item.marks ?? []),
                { type: 'link', attrs: { href: node.url } },
              ],
            }
          : item,
      );
    });
  }

  if (node.kind === 'break') {
    return [{ type: 'hardBreak' }];
  }

  if (node.kind === 'math') {
    return [{
      type: node.display ? 'blockMath' : 'inlineMath',
      attrs: {
        latex: node.latex ?? '',
        src: node.src ?? null,
        display: node.display,
      },
    }];
  }

  if (node.kind === 'image') {
    if (node.formula) {
      return [{
        type: 'formulaImage',
        attrs: {
          src: node.src ?? null,
          latex: node.latex ?? '',
          width: node.width ?? null,
          height: node.height ?? null,
          style: node.attributes?.style ?? '',
        },
      }];
    }

    return [{
      type: 'image',
      attrs: {
        src: node.src ?? null,
        alt: node.alt,
        width: node.width ?? null,
        height: node.height ?? null,
        inlineStyle: cssToStyle(node.css),
      },
    }];
  }

  if (node.kind === 'anchor') {
    return [{ type: 'bookmark', attrs: { id: node.id } }];
  }

  if (node.kind === 'unsupported') {
    return [{ type: 'text', text: node.label }];
  }

  return [];
}
```

### 7.2 段落映射

```ts
function mapParagraph(paragraph: Paragraph): TiptapNode[] {
  const blockMathIndexes = paragraph.children
    .map((child, index) => child.kind === 'math' && child.display ? index : -1)
    .filter((index) => index >= 0);

  if (!blockMathIndexes.length) {
    return [createParagraphOrHeading(paragraph)];
  }

  const result: TiptapNode[] = [];
  let buffer: Inline[] = [];

  const flush = () => {
    if (!buffer.length) return;
    result.push(createParagraphOrHeading({ ...paragraph, children: buffer }));
    buffer = [];
  };

  for (const child of paragraph.children) {
    if (child.kind === 'math' && child.display) {
      flush();
      result.push({
        type: 'blockMath',
        attrs: {
          latex: child.latex ?? '',
          src: child.src ?? null,
          display: true,
        },
      });
    } else {
      buffer.push(child);
    }
  }

  flush();
  return result;
}
```

`createParagraphOrHeading` 根据 `style.outline` 选择普通段落或标题：

```ts
function createParagraphOrHeading(paragraph: Paragraph): TiptapNode {
  const level = paragraph.style.outline === undefined
    ? null
    : Math.min(6, Math.max(1, paragraph.style.outline + 1));
  const content = paragraph.children.flatMap(mapInline);
  const inlineStyle = cssToStyle(paragraph.style.css);

  return {
    type: level === null ? 'paragraph' : 'heading',
    attrs: {
      ...(level === null ? {} : { level }),
      ...(inlineStyle ? { inlineStyle } : {}),
      ...(paragraph.style.css['text-align']
        ? { textAlign: paragraph.style.css['text-align'] }
        : {}),
    },
    ...(content.length ? { content } : {}),
  };
}
```

### 7.3 列表映射

列表是 Block 级分组，不能把每个带 `list` 的段落都独立转换成两个普通段落。

处理顺序：

1. 连续读取 `kind === 'paragraph'` 且 `list.id` 相同的 Block。
2. 根据 `list.format` 判断有序或无序。
3. 根据 `list.level` 构建嵌套。
4. 有序列表使用第一个段落的 `list.start`。
5. 每个段落转换为 `listItem > paragraph`。

### 7.4 表格映射

```ts
function mapTable(table: Table): TiptapNode {
  return {
    type: 'table',
    attrs: {
      inlineStyle: cssToStyle(table.css),
    },
    content: table.rows.map((row) => ({
      type: 'tableRow',
      attrs: {
        inlineStyle: cssToStyle(row.css),
      },
      content: row.cells.map((cell) => ({
        type: 'tableCell',
        attrs: {
          colspan: cell.colspan,
          rowspan: cell.rowspan,
          inlineStyle: cssToStyle(cell.css),
        },
        content: cell.blocks.length
          ? mapBlocks(cell.blocks)
          : [{ type: 'paragraph' }],
      })),
    })),
  };
}
```

Block 顶层循环需要处理列表分组：

```ts
function mapBlocks(blocks: Block[]): TiptapNode[] {
  const result: TiptapNode[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];

    if (block.kind === 'table') {
      result.push(mapTable(block));
      index += 1;
      continue;
    }

    if (block.list) {
      const listBlocks: Paragraph[] = [];
      const listId = block.list.id;

      while (
        index < blocks.length &&
        blocks[index].kind === 'paragraph' &&
        (blocks[index] as Paragraph).list?.id === listId
      ) {
        listBlocks.push(blocks[index] as Paragraph);
        index += 1;
      }

      result.push(mapList(listBlocks));
      continue;
    }

    result.push(...mapParagraph(block));
    index += 1;
  }

  return result;
}
```

`mapList` 根据 `list.level` 构建嵌套，并根据 `list.format` 决定 `orderedList` 或 `bulletList`。每个 `listItem` 内至少要有一个 paragraph。

### 7.5 图注

HTML 渲染阶段会识别：

- 单图片段落 + 后一段“图 x”文本：生成 `<figure><figcaption>`
- “表 x”文本 + 后续表格：生成 `<caption>`

JSON 仍然保留原始段落结构，同时：

- 图注匹配后的图片 `alt` 和 `attributes.alt` 可能已经被图注文字替代
- 表格的 `caption` 可以使用 `Table.caption`

如果需要 Tiptap 图片 figure 视图，建议按相同规则把相邻 caption 段落合并进图片节点；如果不需要，可以保留为普通段落。

## 8. 最大程度还原 HTML

### 8.1 首选直接还原

```ts
const html = await renderJsonToHtml(document, {
  output: 'document',
  title: '我的文档',
});
```

`renderJsonToHtml` 会优先消费 JSON 中的：

- 图片 `src`
- 公式 `src`
- 图片和公式的 `attributes`
- 段落、表格、列表样式
- 图注结构

因此它不需要原始 DOCX 包，也不需要重新执行图片格式转换。

### 8.2 Tiptap 原生节点还原

如果目标编辑器必须使用原生节点，保真重点是：

1. 保存原始样式对象，不要只保留 class。
2. 图片和公式保留 `src`、尺寸、`vertical-align` 和 data 属性。
3. 表格保留合并信息、边框、底色、宽度和 padding。
4. 段落保留对齐、缩进、间距、行高和标题级别。
5. 列表保留层级、起始编号和类型。
6. 图注保留分组关系。
7. 空段落在 Tiptap 中补充为空 paragraph，避免结构非法。

### 8.3 自定义 NodeView 的推荐 attrs

图片：

```ts
{
  src: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  inlineStyle: string;
  sourceAttributes?: Record<string, string>;
}
```

公式：

```ts
{
  latex: string;
  src: string | null;
  display: boolean;
  style: string;
  sourceAttributes?: Record<string, string>;
}
```

`sourceAttributes` 可以保存转换器提供的 `attributes`，在 `renderHTML` 时优先合并：

```ts
renderHTML({ node }) {
  const source = node.attrs.sourceAttributes ?? {};
  return ['img', {
    ...source,
    src: node.attrs.src,
    alt: node.attrs.latex || source.alt || '公式',
    class: source.class ||
      `formula-item formula-image image-${node.attrs.display ? 'block' : 'inline'}`,
    'data-type': 'formula',
    'data-latex': node.attrs.latex,
  }];
}
```

不要直接把整个 `attributes` 当成 Tiptap 节点内容。它们是 HTML 投影属性，节点类型和结构仍由 `kind` 决定。

## 9. 完整调用示例

```ts
import {
  convertToJson,
  renderJsonToHtml,
  type JsonConversionResult,
} from '@agilehub/docx-converter';

async function importDocx(file: File, editor: Editor) {
  const result: JsonConversionResult = await convertToJson(file, {
    output: 'fragment',
    formulaOutput: 'image',
    generatedImageOutput: 'png',
    imageHandler: {
      convert: convertMetafileImage,
    },
  });

  const unsupported = result.warnings.filter((warning) =>
    [
      'UNSUPPORTED_IMAGE',
      'UNSUPPORTED_MATH',
      'UNSUPPORTED_GROUP_DRAWING',
      'UNSUPPORTED_INLINE',
    ].includes(warning.code),
  );

  const tiptapContent = convertDocxDocumentToTiptap(result.document);
  editor.commands.insertContent(tiptapContent);

  if (unsupported.length) {
    console.warn('部分 DOCX 内容已降级', unsupported);
  }
}

async function previewFromStoredJson(document: DocumentModel) {
  return renderJsonToHtml(document, { output: 'fragment' });
}
```

`convertDocxDocumentToTiptap` 不是库内置的通用 Tiptap schema 实现，而是接入方根据本文规则编写的适配函数。它需要与目标项目实际注册的节点名称、attrs 和 mark 保持一致。

## 10. 注意事项

### 10.1 不要按 HTML DOM 节点数一一对齐

HTML 与 JSON 是不同层次：

- 一个 `TextNode` 可能被拆成多个 `<span>`
- 一个 Paragraph 可能变成 `p`、`h1` 到 `h6` 或列表项
- 图片和后续图注段落可能合并为 `figure`
- 表格标题文本可能变成 `caption`
- 列表段落会合并为 `ol`、`ul`、`li`

应当按语义节点映射，而不是按 DOM 标签数量对齐。

### 10.2 不要把 class 当作唯一类型判断

推荐判断顺序：

```ts
node.kind
node.formula
node.display
node.style
```

`attributes.class` 只用于 HTML 还原和样式兼容。

### 10.3 公式与旧版 OLE 公式不同

- OMML 公式使用 `kind: 'math'`
- OLE、MathType 公式预览使用 `kind: 'image'` 且 `formula: true`
- OLE 公式的 `latex` 可能缺失

如果目标编辑器需要可编辑公式，应优先使用 `latex`；缺失时显示图片，不要猜测公式内容。

### 10.4 图片可能不是普通位图

`ImageNode` 也可能是：

- 组合图形
- 原生折线图、柱形图或 SmartArt 生成的图片
- 公式预览

应通过 `formula`、`generatedKind`、`path` 和 `attributes` 保留上下文。

### 10.5 表格嵌套需要递归

单元格中可以继续出现 Table、Paragraph、Image 和 Math。实现中必须递归处理 `cell.blocks`。

### 10.6 Tiptap schema 必须覆盖所有输出

如果 schema 缺少 `tableCell`、`hardBreak`、`textStyle`、上下标或自定义公式节点，Tiptap 会在 `insertContent` 阶段自动丢弃对应内容。

### 10.7 空内容需要补齐

Tiptap 的 paragraph、tableCell 等节点有内容约束。转换时应把空操作符替换成：

```ts
{ type: 'paragraph' }
```

### 10.8 浮动内容会线性化

浮动图片、文本框、页眉页脚、脚注和批注存在明确边界。当前模型会保留可支持的正文内容并生成警告，但不能保证还原 Word 浮动位置和分页效果。

### 10.9 使用相同选项比较 HTML 和 JSON

`convertToHtml` 和 `convertToJson` 是两次独立转换。比较或还原时应使用相同选项：

```ts
const options = {
  output: 'fragment',
  formulaOutput: 'image',
  generatedImageOutput: 'svg',
} as const;

const [html, json] = await Promise.all([
  convertToHtml(file, options),
  convertToJson(file, options),
]);
```

PNG 模式通常也能还原一致；使用 SVG 更容易比较公式和图表源内容。

### 10.10 warnings 需要保留

以下情况通常会降级：

- 不支持的 WMF/EMF/TIFF 图片
- 无法转换的公式结构
- 浮动图片
- 复杂列表编号
- 域结果
- 未支持的绘图或结构

这些内容仍可能以占位、缓存结果或原始资源形式保留。接入方应展示或记录 `result.warnings`，不要静默忽略。

## 11. 验收建议

建议为接入方建立以下测试：

1. JSON 经过 `JSON.stringify` 和 `JSON.parse` 后仍可转换。
2. `renderJsonToHtml(json.document, options)` 与原始 HTML 结构一致。
3. 每个公式的 `latex`、`src`、`display`、`data-type` 与 HTML 一致。
4. 每个图片的 `src`、`alt`、尺寸、class 与 HTML 一致。
5. 表格的 rowspan、colspan、边框、底色和单元格内容一致。
6. 列表层级和起始编号一致。
7. 图注图片的 `alt` 与 HTML 一致。
8. 所有 warning 都能被业务层感知。

本仓库的 `tests/integration/json-restore.test.ts` 已覆盖：

- 行内公式
- 独立行公式
- 图片
- 图注
- 表格
- JSON 序列化和反序列化
- JSON 还原 HTML 字符串一致性
