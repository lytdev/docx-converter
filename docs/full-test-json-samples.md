# DOCX 导出 JSON 解析参考

本文提供一个自包含、可直接复制并通过 `JSON.parse` 解析的 `convertToJson` 示例。示例结构来自全量测试文档的实际输出，但下方 JSON 已移除对附件文件的依赖，第三方可以直接按此结构实现解析器。

```ts
const result = await convertToJson(file, {
  output: 'fragment',
  formulaOutput: 'image',
});
```

## 1. 顶层结构

```ts
interface JsonConversionResult {
  meta: {
    title: string;
    [name: string]: unknown;
  };
  elements: HtmlJsonNode[];
}
```

顶层只包含两个字段：

- `meta`：DOCX 文档元数据。
- `elements`：正文 HTML 元素树的顶层节点。

## 2. 完整示例

以下内容是一个完整 JSON 对象，所有数组和对象均为合法 JSON，可以直接交给第三方解析。

```json
{
  "meta": {
    "title": "示例文档",
    "creator": "示例作者",
    "lastModifiedBy": "wps",
    "created": "2026-11-06T02:53:00Z",
    "modified": "2026-11-06T03:24:53Z",
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
        "left": "90pt",
        "header": "42.55pt",
        "footer": "49.6pt",
        "gutter": "0pt"
      }
    },
    "theme": {
      "name": "WPS",
      "colors": {
        "dk1": "#000000",
        "lt1": "#FFFFFF",
        "dk2": "#44546A",
        "lt2": "#E7E6E6",
        "accent1": "#4874CB",
        "accent2": "#EE822F",
        "accent3": "#F2BA02",
        "accent4": "#75BD42",
        "accent5": "#30C0B4",
        "accent6": "#E54C5E",
        "hlink": "#0026E5",
        "folHlink": "#7E1FAD"
      },
      "fonts": {
        "major": {
          "latin": "Calibri Light",
          "eastAsia": "宋体"
        },
        "minor": {
          "latin": "Calibri",
          "eastAsia": "宋体"
        }
      }
    }
  },
  "elements": [
    {
      "tag": "p",
      "id": "adb25920-4c44-4fdc-af59-24a8f95802a8",
      "text": "目录",
      "class": [],
      "style": {
        "text-align": "center",
        "margin-left": "0pt",
        "margin-right": "0pt",
        "text-indent": "0em",
        "margin-top": "0pt",
        "margin-bottom": "0pt",
        "line-height": "1",
        "font-size": "10.5pt"
      },
      "attribute": {},
      "children": [
        {
          "tag": "span",
          "id": "f6cfa8ba-e39b-4ad0-8c7f-7b8ba34ea2d6",
          "text": "目录",
          "class": [],
          "style": {
            "font-family": "\"宋体\"",
            "font-size": "10.5pt",
            "white-space": "pre-wrap"
          },
          "attribute": {},
          "children": []
        }
      ]
    },
    {
      "tag": "ol",
      "id": "adacd144-afb2-4aa4-ae3d-349b41d8b5d2",
      "text": "基本排版",
      "class": [],
      "style": {
        "list-style-type": "decimal"
      },
      "attribute": {},
      "start": "1",
      "children": [
        {
          "tag": "li",
          "id": "f2303723-302f-4aa2-9ae0-6a65658f5e43",
          "text": "基本排版",
          "class": [],
          "style": {
            "text-align": "justify",
            "margin-top": "17pt",
            "margin-bottom": "16.5pt",
            "line-height": "2.4",
            "font-size": "22pt"
          },
          "attribute": {},
          "children": [
            {
              "tag": "a",
              "id": "bookmark-_Toc17414",
              "text": "",
              "class": [],
              "style": {},
              "attribute": {},
              "children": []
            },
            {
              "tag": "span",
              "id": "d68f431d-00bb-4928-a046-58c9d76fab10",
              "text": "基本排版",
              "class": [],
              "style": {
                "font-family": "\"宋体\",\"Calibri\"",
                "font-size": "22pt",
                "font-weight": "bold",
                "white-space": "pre-wrap"
              },
              "attribute": {},
              "children": []
            }
          ]
        }
      ]
    },
    {
      "tag": "table",
      "id": "579f89fa-05bb-41a2-b191-13df5d002a4f",
      "text": "表1-1-1 插画特点与分类边框样式分类维度具体类别详细内容",
      "class": [],
      "style": {
        "border-collapse": "collapse",
        "border": "none",
        "max-width": "100%",
        "width": "99.96%",
        "margin-left": "auto",
        "margin-right": "auto"
      },
      "attribute": {},
      "children": [
        {
          "tag": "caption",
          "id": "89a5fb26-3b28-4cd9-b6c2-8be4e4eb6d41",
          "text": "表1-1-1 插画特点与分类边框样式",
          "class": [],
          "style": {
            "text-align": "center",
            "margin-left": "0pt",
            "margin-right": "0pt",
            "text-indent": "2em",
            "line-height": "1.5",
            "font-size": "10.5pt"
          },
          "attribute": {},
          "children": [
            {
              "tag": "span",
              "id": "1fcb7e9d-58b0-4c96-bfe6-2f24df88a831",
              "text": "表1-1-1 插画特点与分类边框样式",
              "class": [],
              "style": {
                "font-family": "\"宋体\",\"Times New Roman\"",
                "font-size": "14pt",
                "color": "#000000",
                "white-space": "pre-wrap"
              },
              "attribute": {},
              "children": []
            }
          ]
        },
        {
          "tag": "tbody",
          "id": "849cf002-9aa3-4c4b-947a-a5f1b4c77b9d",
          "text": "分类维度具体类别详细内容",
          "class": [],
          "style": {},
          "attribute": {},
          "children": [
            {
              "tag": "tr",
              "id": "6ff352c4-cdbe-48ea-a07b-40fa57432bdc",
              "text": "分类维度具体类别详细内容",
              "class": [],
              "style": {
                "height": "19.1pt"
              },
              "attribute": {},
              "children": [
                {
                  "tag": "td",
                  "id": "ec2fedeb-1c21-4526-b2d9-f575ea3ff06f",
                  "text": "分类维度",
                  "class": [],
                  "style": {
                    "padding": "4pt 5pt",
                    "width": "18.36%",
                    "background-color": "#DCEEF8",
                    "vertical-align": "middle",
                    "border-top": "0.5pt solid #008DCB",
                    "border-bottom": "0.5pt solid #008DCB",
                    "border-left": "none",
                    "border-right": "0.5pt solid #008DCB"
                  },
                  "attribute": {},
                  "rowspan": "2",
                  "colspan": "1",
                  "children": [
                    {
                      "tag": "p",
                      "id": "a399bfb7-1bdd-4bf4-9154-c70e1a1fe232",
                      "text": "分类维度",
                      "class": [],
                      "style": {
                        "text-align": "center",
                        "line-height": "1.5",
                        "font-size": "8pt"
                      },
                      "attribute": {},
                      "children": [
                        {
                          "tag": "span",
                          "id": "c7f58043-5949-4f06-b15c-f773786b8e73",
                          "text": "分类维度",
                          "class": [],
                          "style": {
                            "font-family": "\"黑体\"",
                            "font-size": "12pt",
                            "color": "#000000",
                            "white-space": "pre-wrap"
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
          ]
        }
      ]
    },
    {
      "tag": "figure",
      "id": "25095b12-9067-4fcd-a34c-a0ddf47ad71b",
      "text": "示例图片",
      "class": [],
      "style": {},
      "attribute": {},
      "children": [
        {
          "tag": "img",
          "id": "e7405226-2452-4590-975b-a96acf1152c4",
          "text": "",
          "class": [
            "image-item",
            "image-block"
          ],
          "style": {
            "max-width": "100%",
            "width": "100px",
            "height": "50px",
            "object-fit": "contain"
          },
          "attribute": {
            "data-type": "image"
          },
          "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSf8AAAAASUVORK5CYII=",
          "alt": "示例图片",
          "children": []
        },
        {
          "tag": "figcaption",
          "id": "91e2fcf5-9233-4e38-bc51-b7c0ec3d8167",
          "text": "图 1 示例图片",
          "class": [],
          "style": {},
          "attribute": {},
          "children": []
        }
      ]
    },
    {
      "tag": "p",
      "id": "ccbe5db7-c260-49f2-8873-cc0063d788f6",
      "text": "",
      "class": [],
      "style": {},
      "attribute": {},
      "children": [
        {
          "tag": "img",
          "id": "db69b1e2-55f4-4038-a0cc-d5ef942534be",
          "text": "",
          "class": [
            "formula-item",
            "formula-image",
            "image-inline"
          ],
          "style": {
            "max-width": "100%",
            "width": "1.689ex",
            "height": "1.062ex",
            "vertical-align": "middle"
          },
          "attribute": {
            "data-type": "formula",
            "data-latex": "x"
          },
          "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSf8AAAAASUVORK5CYII=",
          "alt": "x",
          "children": []
        }
      ]
    }
  ]
}
```

## 3. HtmlJsonNode 契约

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

所有元素，包括 `p`、`span`、`table`、`td`、`img` 和 MathML 元素，都使用同一结构递归表示。

| 字段 | 必须 | 说明 |
| --- | --- | --- |
| `tag` | 是 | 小写 HTML 标签名 |
| `id` | 是 | 原 HTML 的 ID；不存在时由转换器生成 UUID |
| `text` | 是 | 元素完整文本；图片通常为空字符串 |
| `class` | 是 | class 值拆分后的数组 |
| `style` | 是 | 内联样式解析后的对象 |
| `attribute` | 是 | `data-*`、`aria-*` 和未知扩展属性 |
| `children` | 是 | 直接子元素数组 |

标准属性直接放在节点根对象，例如 `src`、`alt`、`href`、`rowspan`、`colspan`、`start`、`title`、`hidden` 和 `contenteditable`。

## 4. 属性分类

```json
{
  "tag": "td",
  "id": "cell-id",
  "text": "合并单元格",
  "class": ["cell", "highlight"],
  "style": {
    "background-color": "#FFFF00"
  },
  "rowspan": "2",
  "colspan": "2",
  "title": "说明",
  "hidden": "hidden",
  "contenteditable": "true",
  "attribute": {
    "data-type": "summary",
    "data-source": "word",
    "aria-label": "合并单元格"
  },
  "children": []
}
```

第三方解析时应优先读取根对象的标准属性，再读取 `attribute` 中的扩展属性。

## 5. 公式的两种形式

### 5.1 公式图片

默认 `formulaOutput: 'image'`：

```json
{
  "tag": "img",
  "id": "formula-image-id",
  "text": "",
  "class": ["formula-item", "formula-image", "image-inline"],
  "style": {
    "max-width": "100%",
    "width": "1.689ex",
    "height": "1.062ex",
    "vertical-align": "middle"
  },
  "attribute": {
    "data-type": "formula",
    "data-latex": "x"
  },
  "src": "data:image/png;base64,iVBORw0KGgo=",
  "alt": "x",
  "children": []
}
```

### 5.2 MathML

设置 `formulaOutput: 'mathml'` 时：

```json
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
  "children": [
    {
      "tag": "math",
      "id": "mathml-id",
      "text": "x",
      "class": [],
      "style": {},
      "attribute": {},
      "children": [
        {
          "tag": "mi",
          "id": "mathml-mi-id",
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

## 6. 批注和脚注

批注和脚注都属于行内节点。批注使用 `span`，脚注使用上标 `sup`。下面的片段同时包含普通正文、一条批注和一个脚注引用：

```json
{
  "tag": "p",
  "id": "paragraph-id",
  "text": "正文中国式现代化1",
  "class": [],
  "style": {},
  "attribute": {},
  "children": [
    {
      "tag": "span",
      "id": "body-text-id",
      "text": "正文",
      "class": [],
      "style": {
        "font-size": "12pt",
        "white-space": "pre-wrap"
      },
      "attribute": {},
      "children": []
    },
    {
      "tag": "span",
      "id": "annotation-id",
      "text": "中国式现代化",
      "class": ["annotation-item"],
      "style": {
        "font-size": "12pt",
        "white-space": "pre-wrap"
      },
      "attribute": {
        "data-type": "annotation",
        "data-annotation": "中国式现代化的批注"
      },
      "children": []
    },
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
  ]
}
```

如果批注覆盖公式、图片等已经带 `data-type` 的内容，外层批注节点会保留 `children`：

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

解析批注时要读取 `attribute["data-annotation"]`，不能只依赖 `text`。解析脚注时要读取 `text` 作为显示编号，并读取 `attribute["data-footnote"]` 作为正文。未选中文字的零长度批注当前不会输出节点。

## 7. 第三方解析流程

1. 解析顶层 JSON，确认对象包含 `meta` 和 `elements`。
2. 遍历 `elements`，把每个节点转换为目标编辑器或业务节点。
3. 使用 `tag` 判断元素类型。
4. 使用 `text` 读取元素文本；有 `children` 时递归处理子元素。
5. 使用 `class`、`style`、标准根属性和 `attribute` 恢复呈现信息。
6. `span` 的 `attribute["data-type"] === "annotation"` 表示批注，读取 `data-annotation`；有 `children` 时必须继续递归。
7. `sup` 的 `attribute["data-type"] === "footnote"` 表示脚注，读取显示编号和 `data-footnote`。
8. 表格递归处理 `table → caption/tbody → tr → td`。
9. 列表递归处理 `ol/ul → li`，`start` 和 `list-style-type` 分别控制起始编号和列表类型。
10. 图片读取 `src` 和 `alt`；公式图片还需读取 `attribute["data-type"]` 和 `attribute["data-latex"]`。

## 8. 与 HTML 的一致性

`convertToJson` 直接解析本次 `convertToHtml` 的输出。`renderJsonToHtml` 会再次生成对应 HTML。

一致性比较规则：

- 比较标签层级、文本、class、style、标准属性和扩展属性。
- 忽略自动生成的 `id`。
- 不按属性书写顺序压缩后的 HTML 字符串直接比较。

仓库校验命令：

```sh
npm run check:html-json -- input.docx report.json
```

报告会输出：

```json
{
  "metaMatch": true,
  "structureMatch": true,
  "restoredMatch": true,
  "ignoredAttributes": ["id"],
  "differences": {
    "meta": [],
    "structure": [],
    "restored": []
  }
}
```
