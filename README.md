# DOCX → HTML / JSON 转换器

[![npm version](https://img.shields.io/npm/v/@agilehub/docx-converter.svg)](https://www.npmjs.com/package/@agilehub/docx-converter)
[![npm license](https://img.shields.io/npm/l/@agilehub/docx-converter.svg)](https://www.npmjs.com/package/@agilehub/docx-converter)

一个使用 **TypeScript + Vite** 实现的 DOCX 转换库，可在浏览器或 Node.js 中将 Word 文档转换为 HTML 或 JSON。转换在本机执行，不依赖 Word、后端服务或在线公式服务。

## 目录

- [安装](#安装)
- [快速开始](#快速开始)
- [方法](#方法)
- [参数](#参数)
- [返回值](#返回值)
- [更多文档](#更多文档)

## 安装

```sh
npm install @agilehub/docx-converter
```

也可以使用 `pnpm add @agilehub/docx-converter` 或 `yarn add @agilehub/docx-converter`。包内自带 TypeScript 类型声明，提供 ESM、CommonJS 和 UMD 构建。Node.js 环境要求 **22.12+**。

## 快速开始

### 浏览器或构建工具

```ts
import { convertToHtml } from '@agilehub/docx-converter';

const file = document.querySelector<HTMLInputElement>('#file')!.files![0];
const result = await convertToHtml(file, { title: file.name });

const frame = document.querySelector<HTMLIFrameElement>('#preview')!;
frame.setAttribute('sandbox', '');
frame.srcdoc = result.html;
```

`warnings` 应展示给用户。生成的完整 HTML 已包含基础样式，图片默认以内嵌 Data URI 输出。

### Node.js

```ts
import { writeFile } from 'node:fs/promises';
import { convertToHtmlFile, convertToJsonFile } from '@agilehub/docx-converter/node';

const html = await convertToHtmlFile('report.docx');
const json = await convertToJsonFile('report.docx');

await writeFile('report.html', html.html, 'utf8');
await writeFile('report.json', JSON.stringify(json, null, 2), 'utf8');
```

Node 文件入口负责读取本地路径，输出文件由调用方写入。主入口也接受 Node `Buffer`，但不会把字符串当作本地路径。

### 普通 script 标签

从 npm 包的 `dist/` 中取 `docx-converter.umd.cjs`，复制到静态资源目录后引用：

```html
<script src="/assets/docx-converter.js"></script>
<script>
  const file = document.querySelector('#file').files[0];
  const result = await DocxConverter.convertToHtml(file);
  document.querySelector('#preview').srcdoc = result.html;
</script>
```

UMD 版本暴露全局对象 `window.DocxConverter`。`.cjs` 可能无法被静态服务器识别为 JavaScript，建议将文件重命名为 `.js`。

## 方法

| 入口 | 方法 | 返回值 |
| --- | --- | --- |
| `@agilehub/docx-converter` | `convertToHtml(input, options?)` | `Promise<ConversionResult>` |
| `@agilehub/docx-converter` | `convertToJson(input, options?)` | `Promise<JsonConversionResult>` |
| `@agilehub/docx-converter` | `renderJsonToHtml(document, options?)` | `Promise<string>` |
| `@agilehub/docx-converter/node` | `convertToHtmlFile(path, options?)` | `Promise<ConversionResult>` |
| `@agilehub/docx-converter/node` | `convertToJsonFile(path, options?)` | `Promise<JsonConversionResult>` |
| 普通 script 标签 | `DocxConverter.convertToHtml / convertToJson` | 与 npm 主入口相同 |

### 输入 `input`

主入口的 `input` 类型为 `string | Blob | ArrayBuffer | Uint8Array`：

| 输入 | 说明 |
| --- | --- |
| 浏览器 `File` | 文件选择器或拖放得到的文件，直接传入。 |
| `ArrayBuffer` / `Uint8Array` | 已读取的 DOCX 二进制数据。 |
| Node `Buffer` | 属于 `Uint8Array`，可直接使用。 |
| `string` | 仅接受完整的 HTTP(S) DOCX 地址，不是本地文件路径。 |

本地文件路径请使用 Node 的 `convertTo*File` 方法。网络地址下载、跨域和超时行为见 [进阶能力](docs/advanced-features.md#网络地址转换)。

## 参数

### 转换选项 `options`

| 参数 | 类型 / 可选值 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `output` | `'document' \| 'fragment'` | `'document'` | HTML 输出为完整页面或正文片段。 |
| `title` | `string` | `'DOCX 转换文档'` | 完整 HTML 页面的 `<title>`，不修改正文标题。 |
| `formulaOutput` | `'image' \| 'mathml'` | `'image'` | OMML 公式输出为图片，或保留语义 MathML。 |
| `generatedImageOutput` | `'png' \| 'svg'` | `'png'` | OMML 公式和原生图表生成图片的格式。 |
| `drawingOutput` | `'png' \| 'svg'` | 继承 `generatedImageOutput` | Word 组合图形的图片格式。 |
| `imageHandler` | 对象 | 内嵌 Base64 | 图片转换、大小阈值和自定义地址。 |
| `onProgress` | `(event: ProgressEvent) => void` | 不回调 | 接收转换阶段进度。 |
| `signal` | `AbortSignal` | 不设置 | 请求取消转换。 |
| `limits` | `Partial<ConversionLimits>` | 内置限制 | 限制输入大小、解压资源和 XML 深度。 |

### 图片配置 `imageHandler`

图片大小指最终可显示文件的字节数，不是宽高，也不是 Base64 字符串长度。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `base64ImageSize` | `2048`（2 KB） | 小于或等于此值时保持 Base64，大于此值时可交给 `processLargeImage`。`0` 表示所有非空图片都可上传。 |
| `processLargeImage` | 不设置 | `(fileBlob, fileSuffix, fileName) => ProcessedImage \| Promise<ProcessedImage>`，其中 `ProcessedImage` 为 `{ fileUrl, fileSize?, fileName? }`。 |
| `resolve` | 不设置 | `(image: ImageContext) => string \| Promise<string>`，为可显示的普通光栅图片指定地址；未配置上传回调时生效。 |
| `convert` | 内置 EMF 转 PNG | `(image: ImageContext) => ImageResult \| undefined \| Promise<ImageResult \| undefined>`，用于 WMF、TIFF、SVG 等格式的转换。 |

`ImageContext` 包含 `path`、`bytes`、`mimeType`、`alt` 和 `formula`。回调收到的图片可能已经过格式转换；返回的地址会经过安全校验。完整图片处理规则和示例见 [进阶能力](docs/advanced-features.md#图片与图形)。

### 资源限制 `limits`

所有字段均为正整数。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `inputBytes` | `50 MiB` | 输入 DOCX 文件大小上限。 |
| `totalBytes` | `150 MiB` | ZIP 解压后的总资源大小上限。 |
| `entryBytes` | `40 MiB` | 单个 ZIP 条目解压后的大小上限。 |
| `entries` | `10000` | ZIP 条目数上限。 |
| `xmlDepth` | `128` | XML 嵌套深度上限。 |

## 返回值

### HTML

```ts
interface ConversionResult {
  html: string;
  warnings: { code: string; message: string; part?: string }[];
  resources: { path: string; mimeType: string; bytes: Uint8Array }[];
  stats: { paragraphs: number; tables: number; images: number; formulas: number };
}
```

### JSON

`convertToJson` 返回 `{ meta, elements }`。`meta` 包含文档标题、页面和主题信息，`elements` 是递归的 HTML 元素树。节点字段及 JSON 还原 HTML 的说明见 [输出格式](docs/output-formats.md#json)，接入 Tiptap 见 [Tiptap 接入指南](docs/json-tiptap-integration.md)。

## 更多文档

- [输出格式与结果结构](docs/output-formats.md)
- [进阶能力：图片、公式、图表与网络地址](docs/advanced-features.md)
- [错误、进度、限制与兼容性](docs/errors-and-compatibility.md)
- [本地开发、构建与测试](docs/development.md)
- [JSON 到 Tiptap 接入](docs/json-tiptap-integration.md)
- [全量 JSON 样例](docs/full-test-json-samples.md)
- [模块架构](docs/architecture.md)
- [贡献指南](CONTRIBUTING.md)
