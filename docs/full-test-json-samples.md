# DOCX 导出 JSON 示例

以下示例均来自 `convertToJson` 当前的 HTML 元素树格式。为了方便阅读，Base64 `src` 和较长的 `style` 值使用 `...` 节选。

```ts
const result = await convertToJson(file, {
  output: 'fragment',
  formulaOutput: 'image',
  generatedImageOutput: 'svg',
});
```

## 1. 顶层结构

```json
{
  "meta": {
    "title": "",
    "subject": "测试文档",
    "creator": "文档作者",
    "created": "2026-11-08T10:00:00Z",
    "modified": "2026-11-08T10:30:00Z",
    "page": {
      "size": {
        "width": "595.3pt",
        "height": "841.9pt"
      },
      "orientation": "portrait",
      "margin": {
        "top": "72pt",
        "right": "90pt",
        "bottom": "72pt",
        "left": "90pt"
      }
    },
    "theme": {
      "name": "Office",
      "colors": {
        "accent1": "#4472C4"
      },
      "fonts": {
        "major": {
          "latin": "Calibri Light"
        },
        "minor": {
          "latin": "Calibri"
        }
      }
    }
  },
  "elements": []
}
```

`elements` 是 HTML body 内容元素的数组。每项都使用相同节点结构：

```ts
interface HtmlJsonNode {
  tag: string;
  id: string;
  text: string;
  class: string[];
  style: Record<string, string>;
  attribute: Record<string, string>;
  children: HtmlJsonNode[];
  [name: string]: unknown;
}
```

## 2. 标题和段落

```json
{
  "tag": "h1",
  "id": "a4cb843c-3c2c-4b3e-9f9a-6c956f4e7f07",
  "text": "文档转换 · 能力示例",
  "class": [],
  "style": {
    "font-size": "24pt",
    "font-weight": "bold"
  },
  "attribute": {},
  "children": [
    {
      "tag": "span",
      "id": "69c8bf0b-787c-4f5e-9900-3a25f81d95e3",
      "text": "文档转换 · 能力示例",
      "class": [],
      "style": {
        "white-space": "pre-wrap"
      },
      "attribute": {},
      "children": []
    }
  ]
}
```

## 3. 图片

```json
{
  "tag": "img",
  "id": "b3d90826-427a-4be6-bc72-0d809584ded5",
  "text": "",
  "class": ["image-item", "image-block"],
  "style": {
    "max-width": "100%",
    "width": "100px",
    "height": "50px",
    "object-fit": "contain"
  },
  "src": "data:image/png;base64,...",
  "alt": "图 1 示例图片",
  "attribute": {
    "data-type": "image"
  },
  "children": []
}
```

## 4. 公式图片

```json
{
  "tag": "img",
  "id": "3d77bf22-dae1-44d6-9e49-44a25d29c50c",
  "text": "",
  "class": ["formula-item", "formula-image", "image-inline"],
  "style": {
    "max-width": "100%",
    "width": "1.689ex",
    "height": "1.062ex",
    "vertical-align": "middle"
  },
  "src": "data:image/svg+xml;base64,...",
  "alt": "x",
  "attribute": {
    "data-type": "formula",
    "data-latex": "x"
  },
  "children": []
}
```

## 5. MathML

使用 `formulaOutput: 'mathml'` 时：

```json
{
  "tag": "span",
  "id": "4da64f7d-b7c0-40c5-a7b7-bf99858fdeba",
  "text": "x",
  "class": ["formula-item"],
  "style": {},
  "attribute": {
    "data-type": "formula",
    "data-latex": "x"
  },
  "children": [
    {
      "tag": "math",
      "id": "79c5eb12-238f-4a9c-b5f9-410cc03a16ab",
      "text": "x",
      "class": [],
      "style": {},
      "attribute": {},
      "children": [
        {
          "tag": "mi",
          "id": "ab4db51d-3f5d-49f8-950f-24dfb8287000",
          "text": "x",
          "class": [],
          "style": {},
          "attribute": {},
          "children": []
        }
      ]
    }
  ]
}
```

## 6. 表格

```json
{
  "tag": "table",
  "id": "29189c3f-c567-44d4-808f-28162148752e",
  "text": "数据",
  "class": [],
  "style": {
    "border-collapse": "collapse",
    "border": "none",
    "max-width": "100%"
  },
  "attribute": {},
  "children": [
    {
      "tag": "tbody",
      "id": "b39e52ae-bf3d-4832-81ce-b3b51c4e67a1",
      "text": "数据",
      "class": [],
      "style": {},
      "attribute": {},
      "children": [
        {
          "tag": "tr",
          "id": "3859896e-bf07-4ce5-bdcb-c6abf5f189c1",
          "text": "数据",
          "class": [],
          "style": {},
          "attribute": {},
          "children": [
            {
              "tag": "td",
              "id": "9e3a4708-5be6-4eef-b907-96a99e3770ab",
              "text": "数据",
              "class": [],
              "style": {
                "padding": "4pt 5pt",
                "vertical-align": "top"
              },
              "attribute": {},
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

## 7. 属性分类

```json
{
  "tag": "td",
  "id": "cell-id",
  "text": "合并单元格",
  "class": ["cell", "tip"],
  "style": {
    "background-color": "#FFFF00"
  },
  "rowspan": "2",
  "colspan": "2",
  "title": "说明",
  "contenteditable": "true",
  "attribute": {
    "data-type": "summary",
    "data-source": "word",
    "aria-label": "合并单元格"
  },
  "children": []
}
```

`title`、`hidden`、`contenteditable`、`src`、`href`、`rowspan`、`alt` 等在根对象；`data-*`、`aria-*` 和未识别的自定义属性在 `attribute`。
