# demo-全量测试.docx JSON 转换样例与类型说明

本文基于测试文件 `demo-全量测试.docx` 的实际转换结果，按文件中出现的类型提供 JSON 样例、字段说明和 Tiptap 转换建议。

样例命令：

```ts
const result = await convertToJson(file, {
  output: 'fragment',
  formulaOutput: 'image',
  generatedImageOutput: 'svg',
});
```

为了便于阅读，本文对超长的 `src`、`generatedSvg`、`mathml` 文本使用 `...` 表示节选。实际 JSON 中包含完整内容。

完整字段映射和 Tiptap 接入方式见 [JSON 导出后接入 Tiptap](json-tiptap-integration.md)。

## 1. 测试文件覆盖范围

本次转换结果：

| 项目 | 数量 |
| --- | ---: |
| 段落 | 113 |
| 表格 | 5 |
| 图片节点 | 30 |
| OMML 公式节点 | 8 |
| OLE/MathType 公式预览 | 11 |
| 公式总数 | 19 |
| 原始资源 | 38 |

Block 类型：

| 类型 | 数量 |
| --- | ---: |
| `paragraph` | 113 |
| `table` | 5 |

Inline 类型：

| 类型 | 数量 |
| --- | ---: |
| `text` | 263 |
| `anchor` | 10 |
| `math` | 8 |
| `image` | 30 |

图片节点构成：

| 图片类型 | 数量 |
| --- | ---: |
| 行内 PNG | 2 |
| 块级 PNG | 8 |
| 块级 JPEG | 1 |
| 组合图形 SVG | 3 |
| 图表 SVG | 1 |
| 无可用预览的 WMF 图片占位 | 4 |
| 无可用预览的 OLE 公式预览占位 | 11 |

其他实测类型：

- 中文编号列表：`chineseCounting`
- 目录锚点：`bookmark-_Toc...`
- 富文本：粗体、斜体、下划线、上下标、字体、字号、颜色、背景色
- 表格合并：最大 `colspan: 3`、最大 `rowspan: 3`
- 行内 OMML 公式：`display: false`

本次附件中没有出现：

- 普通标题 `outline: 0..5` 的正文标题流。附件中的 `outline: 0` 段落同时属于目录型中文编号列表。
- 独立行 OMML 公式 `display: true`
- 超链接 `link`
- 换行 `break`
- 表格标题 `table.caption`
- 嵌套表格

## 2. 顶层 JSON 结构

`convertToJson` 的完整返回结构：

```json
{
  "document": {
    "blocks": []
  },
  "warnings": [],
  "resources": [],
  "stats": {
    "paragraphs": 113,
    "tables": 5,
    "images": 30,
    "formulas": 19
  }
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `document` | 可递归映射的文档树，是 Tiptap 转换的主要输入 |
| `warnings` | 降级、未支持结构或格式转换警告 |
| `resources` | DOCX 包内原始资源的路径、MIME 和大小，不包含字节 |
| `stats` | 段落、表格、图片、公式统计 |

本次附件的 warning 统计：

```json
{
  "FIELD_RESULT": 1,
  "LIST_FORMAT": 1,
  "FLOATING_IMAGE": 1,
  "UNSUPPORTED_IMAGE": 15
}
```

说明：

- `FIELD_RESULT`：域使用 Word 文件已保存的结果，不重新计算。
- `LIST_FORMAT`：`chineseCounting` 等复杂编号格式在 HTML 中会近似显示。
- `FLOATING_IMAGE`：浮动图片按正文顺序线性化，原浮动位置不保留。
- `UNSUPPORTED_IMAGE`：WMF 等图片未提供转换适配器时应保留原始资源并降级显示。

## 3. 基础段落和文本

### 3.1 普通段落

附件中的“目录”段落：

```json
{
  "kind": "paragraph",
  "style": {
    "css": {
      "text-align": "center",
      "margin-left": "0pt",
      "margin-right": "0pt",
      "text-indent": "0em",
      "margin-top": "0pt",
      "margin-bottom": "0pt",
      "line-height": "1",
      "font-size": "10.5pt"
    }
  },
  "children": [
    {
      "kind": "text",
      "text": "目录",
      "style": {
        "latin": "宋体",
        "eastAsia": "宋体",
        "size": 10.5
      }
    }
  ]
}
```

转换说明：

- `style.css` 是段落 CSS 对象，转换为 Tiptap 的 `inlineStyle`。
- `style.css.font-size` 是字符串 `"10.5pt"`。
- 文本 `style.size` 是数字 `10.5`，单位为 pt。
- Tiptap 中可映射为普通 `paragraph`，不需要根据文本内容判断类型。

对应 Tiptap：

```json
{
  "type": "paragraph",
  "attrs": {
    "inlineStyle": "text-align: center; margin-left: 0pt; margin-right: 0pt; text-indent: 0em; margin-top: 0pt; margin-bottom: 0pt; line-height: 1; font-size: 10.5pt",
    "textAlign": "center"
  },
  "content": [
    {
      "type": "text",
      "text": "目录",
      "marks": [
        {
          "type": "textStyle",
          "attrs": {
            "fontFamily": "宋体",
            "fontSize": "10.5pt"
          }
        }
      ]
    }
  ]
}
```

`latin` 和 `eastAsia` 相同时，应去重后只保留一个字体名。

### 3.2 粗体文本

```json
{
  "kind": "text",
  "text": "基本排版",
  "style": {
    "latin": "Calibri",
    "eastAsia": "宋体",
    "size": 22,
    "bold": true
  }
}
```

转换说明：

- 映射为 Tiptap `bold` mark。
- `latin` 和 `eastAsia` 可同时写入 `textStyle.fontFamily`。
- `size: 22` 转换为 `"22pt"`。

### 3.3 斜体和下划线

```json
{
  "kind": "text",
  "text": "形",
  "style": {
    "latin": "Times New Roman",
    "eastAsia": "宋体",
    "size": 14,
    "color": "#000000",
    "italic": true,
    "underline": true
  }
}
```

转换说明：

- `italic: true` 映射为 `italic` mark。
- `underline: true` 映射为 `underline` mark。
- 同一文本可以同时拥有多个 mark。

### 3.4 颜色和背景

```json
{
  "kind": "text",
  "text": "动态视频",
  "style": {
    "latin": "Times New Roman",
    "eastAsia": "宋体",
    "size": 14,
    "color": "#FF0000",
    "background": "#ffff00"
  }
}
```

转换说明：

- `color` 映射为 `textStyle.color`。
- `background` 映射为 `textStyle.backgroundColor`。
- 十六进制颜色大小写不固定，按原值保留即可。

### 3.5 上标和下标

上标：

```json
{
  "kind": "text",
  "text": "独",
  "style": {
    "latin": "Times New Roman",
    "eastAsia": "宋体",
    "size": 14,
    "color": "#000000",
    "vertical": "superscript"
  }
}
```

下标：

```json
{
  "kind": "text",
  "text": "力",
  "style": {
    "latin": "Times New Roman",
    "eastAsia": "宋体",
    "size": 14,
    "color": "#000000",
    "vertical": "subscript"
  }
}
```

转换说明：

- `vertical: "superscript"` 映射为 `superscript` mark。
- `vertical: "subscript"` 映射为 `subscript` mark。
- `vertical: "baseline"` 不创建上下标 mark。

### 3.6 显式 false

附件表格中存在：

```json
{
  "kind": "text",
  "text": "游客月收入（元）",
  "style": {
    "latin": "黑体",
    "eastAsia": "黑体",
    "size": 9,
    "color": "#000000",
    "bold": false
  }
}
```

转换时必须保留 `bold: false`：

- 不应盲目继承外层粗体。
- `false` 与字段缺失含义不同。

## 4. 目录锚点

附件中的目录标题包含书签锚点：

```json
{
  "kind": "anchor",
  "id": "bookmark-_Toc17414"
}
```

转换说明：

- 映射为 Tiptap bookmark、锚点节点或空 span。
- 目录跳转和正文 `link` 不同。本附件没有出现 `LinkNode`。
- 锚点通常出现在标题文本之前，必须保留顺序。

## 5. 中文编号列表

完整段落样例：

```json
{
  "kind": "paragraph",
  "style": {
    "css": {
      "text-align": "justify",
      "margin-top": "17pt",
      "margin-bottom": "16.5pt",
      "line-height": "2.4",
      "font-size": "22pt"
    },
    "outline": 0,
    "numId": "1",
    "level": 0
  },
  "children": [
    {
      "kind": "anchor",
      "id": "bookmark-_Toc17414"
    },
    {
      "kind": "text",
      "text": "基本排版",
      "style": {
        "latin": "Calibri",
        "eastAsia": "宋体",
        "size": 22,
        "bold": true
      }
    }
  ],
  "list": {
    "id": "1",
    "level": 0,
    "format": "chineseCounting",
    "start": 1,
    "text": "%1、"
  }
}
```

转换说明：

- `list` 只在段落出现，不生成单独列表 Block。
- 连续且 `list.id` 相同的段落必须合成为同一 Tiptap 列表。
- `list.level` 决定嵌套层级。
- `list.start` 用于有序列表起始编号。
- 当前 `format: "chineseCounting"` 不是 Tiptap 原生常见格式，通常需要：
  - 临时映射为 `orderedList`
  - 使用自定义 CSS counter
  - 或转换为普通段落并保留编号文本
- 此处会产生 `LIST_FORMAT` warning。

推荐 Tiptap 结构：

```json
{
  "type": "orderedList",
  "attrs": {
    "start": 1,
    "listStyleType": "cjk-ideographic"
  },
  "content": [
    {
      "type": "listItem",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "基本排版",
              "marks": [{ "type": "bold" }]
            }
          ]
        }
      ]
    }
  ]
}
```

## 6. 行内 OMML 公式

附件实际包含 8 个行内 OMML 公式，没有独立行公式。

较短的实际样例：

```json
{
  "kind": "math",
  "display": false,
  "mathml": "<math xmlns=\"http://www.w3.org/1998/Math/MathML\" display=\"inline\" style=\"font-size:10.5pt\"><mrow>...</mrow></math>",
  "latex": "{\\text{P}}_{\\text{1}}",
  "src": "data:image/svg+xml;base64,PHN2ZyBzdHlsZT0idmVydGljYWwtYWxpZ246IC0wLjM0N2V4OyI...",
  "attributes": {
    "src": "data:image/svg+xml;base64,PHN2ZyBzdHlsZT0idmVydGljYWwtYWxpZ246IC0wLjM0N2V4OyI...",
    "alt": "{\\text{P}}_{\\text{1}}",
    "class": "formula-item formula-image image-inline",
    "data-type": "formula",
    "data-latex": "{\\text{P}}_{\\text{1}}",
    "style": "max-width:100%;width:2.614ex;height:1.752ex;vertical-align:-0.347ex;"
  }
}
```

转换说明：

- `kind: "math"` 与 OLE 公式预览的 `kind: "image"` 不同。
- `display: false` 表示行内公式，应映射为 `inlineMath`。
- `latex` 是重建结果，可能缺少不支持的公式结构。
- `src` 是可直接显示的 SVG 或 PNG data URL。
- `attributes.class` 包含 `image-inline`。
- `data-type` 固定为 `formula`。
- 若目标 Tiptap 公式节点可编辑，优先使用 `latex`。
- 若 `latex` 缺失，则保留 `mathml` 或 `src` 作为展示降级。

Tiptap 建议：

```json
{
  "type": "inlineMath",
  "attrs": {
    "latex": "{\\text{P}}_{\\text{1}}",
    "src": "data:image/svg+xml;base64,...",
    "display": false
  }
}
```

## 7. 普通图片

### 7.1 行内 PNG

附件中的行内小图标：

```json
{
  "kind": "image",
  "path": "word/media/image16.png",
  "alt": "图片 1",
  "formula": false,
  "width": 31.133333333333333,
  "height": 41.8,
  "css": {},
  "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEcAAABgCAIAAADAe/jG...",
  "attributes": {
    "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEcAAABgCAIAAADAe/jG...",
    "alt": "图片 1",
    "class": "image-item image-inline",
    "data-type": "image",
    "style": "max-width:100%;width:31.13px;height:41.8px;object-fit:contain;vertical-align:middle"
  }
}
```

转换说明：

- `formula: false`，按普通图片处理。
- `image-inline` 表示图片与文本或链接在同一行内。
- `attributes.style` 已包含宽度、高度、`object-fit` 和垂直对齐。
- Tiptap 可使用 `inlineImage` 节点，并保留 `src`、`alt`、尺寸和 `inlineStyle`。

### 7.2 块级 PNG

```json
{
  "kind": "image",
  "path": "word/media/image17.png",
  "alt": "图片 2",
  "formula": false,
  "width": 325,
  "height": 187.46666666666667,
  "css": {},
  "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAsAAAAGWCAIAAAD5cqLP...",
  "attributes": {
    "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAsAAAAGWCAIAAAD5cqLP...",
    "alt": "图片 2",
    "class": "image-item image-block",
    "data-type": "image",
    "style": "max-width:100%;width:325px;height:187.47px;object-fit:contain"
  }
}
```

转换说明：

- `image-block` 表示独占段落的图片。
- Tiptap 可使用块级 `image` 节点。
- 尺寸保留在 `width`、`height` 和 `inlineStyle` 中。

### 7.3 带图注的 JPEG

```json
{
  "kind": "image",
  "path": "word/media/image26.jpeg",
  "alt": "图8-3  液压支架机械化铺顶网",
  "formula": false,
  "width": 354.8,
  "height": 182.06666666666666,
  "css": {},
  "src": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA3ADcAAD/2wBD...",
  "attributes": {
    "src": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA3ADcAAD/2wBD...",
    "alt": "图8-3  液压支架机械化铺顶网",
    "class": "image-item image-block",
    "data-type": "image",
    "style": "max-width:100%;width:354.8px;height:182.07px;object-fit:contain"
  }
}
```

转换说明：

- 原 Word 图片描述可能被图注匹配后的文字覆盖。
- `alt` 与 `attributes.alt` 已经保持一致。
- 如果 Tiptap 使用自定义图片 figure，应把后续图注段落映射为 caption。
- 如果使用普通图片节点，可以保留 `alt`，不额外生成图注节点。

## 8. 无法显示的普通图片

附件中有 4 个普通 WMF 图片无法直接显示：

```json
{
  "kind": "image",
  "path": "word/media/image12.wmf",
  "alt": "图片 2118",
  "formula": false,
  "width": 446,
  "height": 48,
  "css": {},
  "attributes": {
    "class": "unsupported-content",
    "data-type": "image",
    "data-resource": "word/media/image12.wmf"
  }
}
```

字段说明：

- 没有 `src`，不能生成可显示图片。
- `path` 和 `attributes["data-resource"]` 指向 DOCX 包内原始资源。
- HTML 会生成 `unsupported-content` 占位。
- JSON 映射时应生成占位节点，并保留原始资源路径。

如果需要显示这些 WMF，下载包调用方应提供图片转换适配器：

```ts
import { convertMetafileImage } from '@agilehub/docx-converter/browser-metafile';

const result = await convertToJson(file, {
  imageHandler: {
    convert: convertMetafileImage,
  },
});
```

## 9. OLE/MathType 公式预览

附件中有 11 个公式预览图片，其中本次 WMF 转换未启用适配器，因此没有 `src`：

```json
{
  "kind": "image",
  "path": "word/media/image1.wmf",
  "alt": "公式",
  "formula": true,
  "width": 77.39999999999999,
  "height": 22.733333333333334,
  "css": {},
  "latex": "χ_{1}^{2}\\sim χ^{2}(n_{1})",
  "attributes": {
    "class": "unsupported-content",
    "data-type": "formula",
    "data-resource": "word/media/image1.wmf"
  }
}
```

转换说明：

- `kind` 是 `image`，不是 `math`。
- 必须通过 `formula: true` 判断它是公式预览。
- `latex` 是 OLE/MTEF 重建值，可能缺失。
- 没有 `src` 时保留占位，不应当普通图片强行渲染。
- 映射到 Tiptap 时应使用公式节点或公式图片节点，而不是普通 image 节点。

如果希望 WMF 预览可以显示，应启用 `convertMetafileImage` 或 Node 的 ImageMagick 适配器。

## 10. 组合图形

附件中有 3 个从 Word 组合图形生成的 SVG：

```json
{
  "kind": "image",
  "alt": "养老金融的内涵；养老金融是中国式现代化的重要组成部分；...",
  "formula": false,
  "width": 513,
  "height": 443.46666666666664,
  "css": {},
  "generatedSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"513\" height=\"443.46666666666664\" viewBox=\"-2 -2 513 443.46666666666664\">...</svg>",
  "generatedKind": "drawing",
  "src": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmci...",
  "attributes": {
    "src": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmci...",
    "alt": "养老金融的内涵；养老金融是中国式现代化的重要组成部分；...",
    "class": "image-item image-block",
    "data-type": "image",
    "style": "max-width:100%;width:513px;height:443.47px;object-fit:contain"
  }
}
```

转换说明：

- `generatedKind: "drawing"` 表示组合图形。
- `generatedSvg` 是生成 SVG 的字符串版本。
- `src` 是最终展示地址，通常优先使用 `src`。
- 图形位置按正文顺序线性化，不保留原浮动位置。

## 11. 原生图表

附件中的柱状图：

```json
{
  "kind": "image",
  "path": "word/charts/chart1.xml",
  "alt": "柱状图",
  "formula": false,
  "width": 533.3333333333334,
  "height": 400,
  "css": {},
  "generatedSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"820\" height=\"500\" viewBox=\"0 0 820 500\">...</svg>",
  "generatedKind": "chart",
  "src": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MjAi...",
  "attributes": {
    "src": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MjAi...",
    "alt": "柱状图",
    "class": "image-item image-block",
    "data-type": "image",
    "style": "max-width:100%;width:533.33px;height:400px;object-fit:contain"
  }
}
```

转换说明：

- `generatedKind: "chart"` 表示从图表缓存生成。
- `path` 指向原始 chart XML。
- `generatedSvg` 和 `src` 都会存在。
- Tiptap 中可按普通块级图片映射，也可以做图表查看器。
- 不重新计算嵌入工作簿。

## 12. 普通表格

附件中有 3 个普通表格。以下是节选：

```json
{
  "kind": "table",
  "css": {
    "border-collapse": "collapse",
    "border": "none",
    "max-width": "100%"
  },
  "rows": [
    {
      "cells": [
        {
          "colspan": 1,
          "rowspan": 1,
          "css": {
            "padding": "4pt 5pt",
            "width": "194.2pt",
            "background-color": "#FFFFFF",
            "vertical-align": "middle",
            "border-top": "1.5pt solid #000000",
            "border-bottom": "0.5pt solid #000000",
            "border-left": "none",
            "border-right": "none"
          },
          "blocks": [
            {
              "kind": "paragraph",
              "style": {
                "css": {
                  "text-align": "center",
                  "margin-top": "0pt",
                  "margin-bottom": "0pt",
                  "font-size": "10.5pt"
                }
              },
              "children": [
                {
                  "kind": "text",
                  "text": "游客月收入（元）",
                  "style": {
                    "latin": "黑体",
                    "eastAsia": "黑体",
                    "size": 9,
                    "color": "#000000",
                    "bold": false
                  }
                }
              ]
            }
          ]
        }
      ],
      "css": {
        "height": "15.5pt"
      }
    }
  ]
}
```

转换说明：

- `table.css` 用于 table。
- `row.css` 用于 tableRow。
- `cell.css` 用于 tableCell。
- `cell.blocks` 必须递归转换。
- 空单元格应补充空 paragraph。
- 本附件没有 `caption`，也没有嵌套表格。

## 13. 合并单元格

附件有 2 个表格包含合并单元格，最大 `colspan` 和 `rowspan` 都是 3。

节选：

```json
{
  "kind": "table",
  "css": {
    "border-collapse": "collapse",
    "border": "none",
    "max-width": "100%",
    "width": "99.96%",
    "margin-left": "auto",
    "margin-right": "auto"
  },
  "rows": [
    {
      "cells": [
        {
          "colspan": 3,
          "rowspan": 1,
          "css": {
            "padding": "4pt 5pt",
            "background-color": "#FFFFFF",
            "vertical-align": "middle"
          },
          "blocks": [
            {
              "kind": "paragraph",
              "style": {
                "css": {
                  "text-align": "center",
                  "font-size": "8pt"
                }
              },
              "children": [
                {
                  "kind": "text",
                  "text": "以气体分子存在于煤体或围岩的孔隙、裂隙或孔洞中，可以自由运动",
                  "style": {
                    "latin": "Times New Roman",
                    "eastAsia": "宋体",
                    "size": 12,
                    "color": "#000000"
                  }
                }
              ]
            }
          ]
        },
        {
          "colspan": 1,
          "rowspan": 3,
          "css": {
            "padding": "4pt 5pt",
            "vertical-align": "middle"
          },
          "blocks": [
            {
              "kind": "paragraph",
              "style": {
                "css": {
                  "text-align": "center",
                  "font-size": "8pt"
                }
              },
              "children": [
                {
                  "kind": "text",
                  "text": "游离状态和吸着状态的瓦斯",
                  "style": {
                    "latin": "Times New Roman",
                    "eastAsia": "宋体",
                    "size": 12,
                    "color": "#000000"
                  }
                }
              ]
            }
          ]
        }
      ],
      "css": {
        "height": "19.1pt"
      }
    }
  ]
}
```

转换说明：

- `colspan` 映射到 Tiptap tableCell 的 `colspan`。
- `rowspan` 映射到 tableCell 的 `rowspan`。
- 合并单元格覆盖的网格位置不会生成空 cell，应按 Tiptap 表格扩展要求处理。
- 边框、背景色、padding 和 vertical-align 全部来自 `cell.css`。

## 14. JSON 到 Tiptap 的类型映射

| JSON 类型 | 判断字段 | Tiptap 建议 |
| --- | --- | --- |
| 普通段落 | `kind: "paragraph"` 且无 `list` | `paragraph` |
| 列表段落 | `paragraph.list` 存在 | 合并为 `orderedList` / `bulletList` |
| 目录锚点 | `kind: "anchor"` | bookmark 或空锚点 |
| 普通文本 | `kind: "text"` | text + marks |
| 行内公式 | `kind: "math"`、`display: false` | `inlineMath` |
| 独立行公式 | `kind: "math"`、`display: true` | `blockMath` |
| 行内图片 | `kind: "image"`、class 包含 `image-inline` | `inlineImage` |
| 块级图片 | `kind: "image"`、class 包含 `image-block` | `image` |
| OLE 公式预览 | `kind: "image"`、`formula: true` | 公式节点 |
| 组合图形 | `generatedKind: "drawing"` | image 或 drawing 节点 |
| 图表 | `generatedKind: "chart"` | image 或 chart 节点 |
| 普通表格 | `kind: "table"` | table → tableRow → tableCell |
| 无可用图片 | `kind: "image"` 且无 `src` | 占位节点 |

## 15. 最大程度还原 HTML

如果目标项目只是为了展示，优先直接使用：

```ts
import { renderJsonToHtml } from '@agilehub/docx-converter';

const html = await renderJsonToHtml(document, {
  output: 'fragment',
});
```

当前 `renderJsonToHtml` 会直接使用：

- `ImageNode.src`
- `MathNode.src`
- `ImageNode.attributes`
- `MathNode.attributes`
- 段落和表格样式
- 列表结构
- 图注后处理

因此不需要原 DOCX、资源包或重新生成图片。

如果使用 Tiptap 原生节点，需要为以下对象提供稳定 attrs：

- 普通图片：`src`、`alt`、`width`、`height`、`inlineStyle`
- 公式：`latex`、`src`、`display`、`style`
- 表格：`colspan`、`rowspan`、`inlineStyle`
- 文本：字体、字号、颜色、背景色和各类 marks

## 16. 接入注意事项

1. 不要把 HTML `<span>` 数量直接对应成 JSON 文本数量。中文和英文可能被拆成多个 span，但 JSON 可能是一个 TextNode。
2. 不要用 `attributes.data-type` 判断 Block 或 Inline 类型，应使用 `kind`。
3. 先判断 `image.formula`，再判断普通图片。
4. `display` 决定公式是行内还是独立行，不能根据图片宽度猜测。
5. 列表必须按连续的 `list.id` 分组，不能把每段单独转换成普通段落。
6. 表格必须递归处理 `cell.blocks`。
7. `bold: false` 等显式 false 应保留。
8. 公式和图片的 `attributes` 是 HTML 投影属性，最适合用于 NodeView 的 `renderHTML`。
9. WMF 图片和 OLE 公式预览可能没有 `src`，应提供资源适配器或占位图。
10. HTML 和 JSON 一致性测试应使用同一份转换选项，尤其是 `generatedImageOutput` 和 `imageHandler`。

## 17. 本附件的验证结论

本附件已经覆盖：

- 基础段落与文本
- 字体、字号、颜色、背景色
- 粗体、斜体、下划线
- 上标、下标
- 目录锚点
- 中文编号列表
- 行内 OMML 公式
- 行内和块级普通图片
- 图注图片
- 图片降级占位
- OLE/MathType 公式预览
- 组合图形
- 原生图表
- 普通表格
- colspan 和 rowspan 合并

以上类型均已在该 JSON 中实际出现，可作为其他项目接入时的主要测试样本。
