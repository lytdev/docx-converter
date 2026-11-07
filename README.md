# DOCX → HTML / JSON / PDF 转换器

[![npm version](https://img.shields.io/npm/v/@agilehub/docx-converter.svg)](https://www.npmjs.com/package/@agilehub/docx-converter)
[![npm license](https://img.shields.io/npm/l/@agilehub/docx-converter.svg)](https://www.npmjs.com/package/@agilehub/docx-converter)

一个用 **TypeScript + Vite** 实现的 DOCX 转换库，可以在浏览器或 Node.js 中把 Word 文档（`.docx`）转换成：

- **HTML**：保留字体、颜色、表格、图片和公式，可直接预览或部署；
- **JSON**：结构化的段落、表格、图片、公式节点，方便二次处理；
- **PDF**：浏览器或 Node.js 中导出 PDF 文件。

转换全部在本机执行，**不依赖 Word、后端服务或在线公式服务**，可以自行保留字体、表格边框和公式结构。

> 第一次使用建议按顺序阅读：**① 安装 → ② 选择调用方式 → ③ 复制最小示例 → ④ 按需查参数**；想先看效果可以直接运行演示。

## 目录

- [安装](#安装)
- [运行演示（快速体验）](#运行演示快速体验)
- [四种调用方式](#四种调用方式)
- [输出结果说明](#输出结果说明)
- [输入类型](#输入类型)
- [API 参考](#api-参考)
- [常见任务示例](#常见任务示例)
- [进阶用法](#进阶用法)
- [错误、进度与取消](#错误进度与取消)
- [支持范围与已知限制](#支持范围与已知限制)
- [常见问题](#常见问题)
- [开发与验证](#开发与验证)

## 安装

```sh
npm install @agilehub/docx-converter
```

也可以使用 `pnpm add @agilehub/docx-converter` 或 `yarn add @agilehub/docx-converter`。包内自带 TypeScript 类型声明，同时提供 ESM、CommonJS 和 UMD 构建；Vite、Vue、React、Next.js 或其他 TypeScript / JavaScript 项目都可以直接使用，不绑定 UI 框架。

Node.js 环境要求 **22.12+**；浏览器端无需额外系统环境，公式字体和图片转换依赖会随 npm 依赖一并安装。

### 从本地 tarball 安装

需要试用仓库中尚未发布的改动时，可以打包后安装：

```sh
# 在本仓库中执行，prepack 会自动完成构建
npm pack

# 在目标项目中安装
npm install /absolute/path/agilehub-docx-converter-0.2.0.tgz
```

### 普通 script 标签

npm 安装包和本仓库的构建产物中都包含 `dist/docx-converter.umd.cjs`（UMD，依赖已内联）。从 npm 安装时文件位于 `node_modules/@agilehub/docx-converter/dist/docx-converter.umd.cjs`；把它复制到网站的静态资源目录即可引用。`.cjs` 的 MIME 类型可能不被浏览器识别，建议重命名为 `docx-converter.js` 后再使用。

```html
<input id="file" type="file" accept=".docx">
<iframe id="preview" sandbox="" title="文档预览"></iframe>
<script src="/assets/docx-converter.js"></script>
<script>
  document.getElementById('file').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const result = await DocxConverter.convertToHtml(file);
      document.getElementById('preview').srcdoc = result.html;
      console.log(result.warnings);
    } catch (error) {
      console.error(error);
    }
  };
</script>
```

UMD 版本会暴露全局对象 `window.DocxConverter`，可直接调用 `convertToHtml`、`convertToJson`、`convertToPdf`。

## 运行演示（快速体验）

环境要求：Node.js **22.12+**（推荐 Node 24）和 npm。

```sh
npm ci
npm run dev
```

打开终端提示的地址（默认 `http://127.0.0.1:5173`），选择或拖入一个 `.docx` 文件，或点击“试用示例文档”。演示页支持预览、查看 HTML 源码、复制内容、下载 HTML / JSON / PDF 和资源 ZIP，并支持取消与 60 秒超时终止。

如果想看构建后的生产版本：

```sh
npm run build
npm run preview
```

`npm run preview` 会启动 `dist-demo` 中的完整浏览器应用。

## 四种调用方式

| 场景 | 入口 | 方法 |
| --- | --- | --- |
| 浏览器项目（Vite / React / Vue 等） | `@agilehub/docx-converter` | `convertToHtml`、`convertToJson`、`convertToPdf` |
| 普通 `<script>` 标签 | `dist/docx-converter.umd.cjs` | `DocxConverter.convertToHtml` 等 |
| Node.js，已有文件路径 | `@agilehub/docx-converter/node` | `convertToHtmlFile`、`convertToJsonFile`、`convertToPdfFile` |
| 浏览器，需要额外图片格式支持 | `@agilehub/docx-converter/browser-metafile` | `convertMetafileImage` |

所有方法都返回 `Promise`，参数中的 `options` 可省略。

### 浏览器 + 构建工具

```ts
import { convertToHtml } from '@agilehub/docx-converter';

const file = document.querySelector<HTMLInputElement>('#file')!.files![0];

const result = await convertToHtml(file, {
  title: file.name,
  onProgress(event) {
    console.log(event.stage, event.completed, event.total);
  },
});

// 使用隔离 iframe 预览；warnings 应展示给用户。
const frame = document.querySelector<HTMLIFrameElement>('#preview')!;
frame.setAttribute('sandbox', '');
frame.srcdoc = result.html;
console.log(result.warnings, result.stats);
```

### Node.js

```ts
import { writeFile } from 'node:fs/promises';
import { convertToHtmlFile, convertToJsonFile } from '@agilehub/docx-converter/node';

const html = await convertToHtmlFile('report.docx');
const json = await convertToJsonFile('report.docx');

await writeFile('report.html', html.html, 'utf8');
await writeFile('report.json', JSON.stringify(json, null, 2), 'utf8');
```

Node 文件入口只负责读取文件，输出文件由调用方写入。主入口的 `convertToHtml(input)` / `convertToJson(input)` 也接受 Node `Buffer`（属于 `Uint8Array`），但不会读取本地路径。

> 本仓库自带一个可直接运行的 Node 示例：
>
> ```sh
> node examples/node.mjs public/sample.docx sample.html
> node examples/node.mjs public/sample.docx sample.json
> ```
>
> 在仓库内运行示例时，Node 会通过包自引用解析到本包的 `exports`，因此请先执行 `npm run build` 生成 `dist/`。

## 输出结果说明

### HTML

```ts
interface ConversionResult {
  html: string;
  warnings: { code: string; message: string; part?: string }[];
  resources: { path: string; mimeType: string; bytes: Uint8Array }[];
  stats: { paragraphs: number; tables: number; images: number; formulas: number };
}
```

`resources` 包括被引用的原始图片及 OLE 文件，即使图片无法显示也会保留。转换后的 PNG 嵌入 HTML；浏览器演示页还会把它们单独导出到资源 ZIP。

`output: 'document'`（默认）返回可直接打开的完整 HTML 页面；`output: 'fragment'` 返回可嵌入现有页面的正文片段。

### JSON

```ts
import { convertToJson, type JsonConversionResult } from '@agilehub/docx-converter';

const result: JsonConversionResult = await convertToJson(file);
JSON.stringify(result, null, 2);
```

结构如下：

```ts
interface JsonConversionResult {
  document: DocumentModel; // 段落/表格/图片/公式组成的文档树
  warnings: Diagnostic[];
  resources: { path: string; mimeType: string; size: number }[];
  stats: { paragraphs: number; tables: number; images: number; formulas: number };
}
```

`result.document.blocks` 是按原文顺序排列的段落与表格；表格单元格内仍然是 `blocks`，段落内的 `children` 包含文字、图片、公式、链接等节点。JSON 结果的 `resources` 只包含资源的 `path`、`mimeType`、`size`，因此整个返回值可以直接序列化；需要原始二进制时请使用 `convertToHtml` 的 `resources`。

图片与公式节点同时包含语义字段和 `attributes`。`attributes` 与对应 HTML 元素的 `src`、`alt`、`class`、`data-type`、`data-latex`、`style` 保持一致，便于调用方在不重复推导 HTML 属性的情况下使用 JSON。

`formulaOutput: 'image'`（默认）时，OMML 公式节点同时包含 MathML、可提取的 LaTeX 和自包含 PNG `src`；设置 `generatedImageOutput: 'svg'` 可改为 SVG，设为 `formulaOutput: 'mathml'` 时不生成图片。`output` 和 `title` 只影响 HTML 包装，对 JSON 文档树没有影响。

JSON 文档树可以直接还原为 HTML，不需要原 DOCX 或资源包：

```ts
import { convertToJson, renderJsonToHtml } from '@agilehub/docx-converter';

const { document } = await convertToJson(file, { output: 'fragment' });
const html = await renderJsonToHtml(document, { output: 'fragment' });
```

还原器优先使用 JSON 图片和公式节点中的 `src` 与 `attributes`，因此与生成 JSON 时相同选项下的原始 HTML 保持一致。

`convertToHtml` 与 `convertToJson` 接受相同的输入和选项，但**是两次独立转换**；如果同时调用，上传回调也会各执行一次。

### PDF

```ts
import { convertToPdf } from '@agilehub/docx-converter';

const result = await convertToPdf(fileOrUrl, { pdf: { format: 'a4', margin: 15 } });
const url = URL.createObjectURL(new Blob([result.bytes], { type: result.mimeType }));
const a = document.createElement('a');
a.href = url;
a.download = 'document.pdf';
a.click();
setTimeout(() => URL.revokeObjectURL(url), 5000);
```

Node 中按文件路径导出：

```ts
import { writeFile } from 'node:fs/promises';
import { convertToPdfFile } from '@agilehub/docx-converter/node';

const result = await convertToPdfFile('./demo.docx', {
  pdf: { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
});
await writeFile('./demo.pdf', result.bytes);
```

`convertToPdf` 默认复用当前的 HTML 转换结果，返回 `{ bytes, mimeType, warnings, resources, stats }`。浏览器通过分页栅格化生成 PDF，**文字不可选中或搜索**；Node 使用 Chromium 打印，**保留可选中文字**。

需要注意：

- 浏览器必须在主线程、有 DOM 的页面中调用；
- Node 默认使用本机已安装的 Chrome；如需使用 Edge 或其他浏览器，用 `pdf.executablePath` 指定可执行文件路径；
- 远程图片受 CORS 和加载权限影响；
- 没有还原 Word 原始分页、页眉和页脚，分页与字体效果取决于运行环境；
- `output` 对 PDF 无效，内部总是生成完整 HTML；
- `signal` 在检查点响应取消，浏览器栅格化阶段无法立即中断。

## 输入类型

`convertToHtml`、`convertToJson`、`convertToPdf` 的第一个参数 `input` 类型为 `string | Blob | ArrayBuffer | Uint8Array`：

| 输入 | 说明 |
| --- | --- |
| 浏览器 `File` | 文件选择器或拖放得到的文件，直接传入即可。 |
| `ArrayBuffer` / `Uint8Array` | 已读取的 DOCX 二进制数据，例如 `fetch` 的 `arrayBuffer()` 结果。 |
| Node `Buffer` | 属于 `Uint8Array`，可直接传给主入口。 |
| `string` | 只接受完整的 **HTTP(S) DOCX 地址**；不是本地文件路径。 |

### 从网络地址转换

```ts
const url = 'https://example.com/document.docx';

const html = await convertToHtml(url, { drawingOutput: 'png' });
const json = await convertToJson(url, { imageHandler: { base64ImageSize: 2048 } });
```

每次调用都会重新下载文档。下载遵循 `limits.inputBytes` 和 `signal`，即使服务器没有返回 `Content-Length`，也会在流式读取时检查大小。只接受 HTTP(S)；下载失败会抛出 `FETCH_FAILED`。浏览器跨域下载要求文件服务器允许 CORS，HTTPS 页面还受混合内容规则限制，库不会自动使用代理。

## API 参考

### 方法一览

```ts
// npm 主入口
convertToHtml(input, options?)   // Promise<ConversionResult>
convertToJson(input, options?)   // Promise<JsonConversionResult>
convertToPdf(input, options?)    // Promise<PdfConversionResult>

// 普通 script 标签
DocxConverter.convertToHtml(input, options?)
DocxConverter.convertToJson(input, options?)
DocxConverter.convertToPdf(input, options?)

// Node 文件入口
convertToHtmlFile(path, options?)
convertToJsonFile(path, options?)
convertToPdfFile(path, options?)
```

所有入口共用同一套 `ConversionOptions`。

### 转换选项 `options`

| 参数 | 类型 / 可选值 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `output` | `'document' \| 'fragment'` | `'document'` | HTML 输出完整页面或正文片段；对 JSON、PDF 无影响。 |
| `title` | `string` | `'DOCX 转换文档'` | 完整 HTML 页面的 `<title>`，不修改正文标题。 |
| `formulaOutput` | `'image' \| 'mathml'` | `'image'` | OMML 公式输出为图片，或保留语义 MathML。 |
| `generatedImageOutput` | `'png' \| 'svg'` | `'png'` | OMML 公式与原生图表的图片格式；默认 PNG。 |
| `drawingOutput` | `'png' \| 'svg'` | 继承 `generatedImageOutput`（默认 PNG） | Word 组合图形的图片格式，可单独覆盖 `generatedImageOutput`。 |
| `imageHandler` | 对象，见下文 | 内嵌 Base64 | 图片格式转换、大小阈值和自定义上传。 |
| `onProgress` | `(event) => void` | 不回调 | 接收转换进度。 |
| `signal` | `AbortSignal` | 不设置 | 传入 `AbortController.signal` 请求取消。 |
| `limits` | `Partial<ConversionLimits>` | 内置限制 | 限制输入大小、解压资源和 XML 深度。 |

### 图片配置 `options.imageHandler`

**这里的“图片大小”指最终可显示文件的字节数，不是宽高，也不是 Base64 字符串长度。** 格式转换先执行，再按字节大小决定是否上传。

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `base64ImageSize` | `2048`（2 KB） | 小于或等于此值的图片保持 Base64；严格大于才调用上传回调。`0` 表示所有非空图片都可交给上传回调。 |
| `processLargeImage` | 不设置 | 自定义大图上传，返回 `{ fileUrl, fileSize?, fileName? }`。`fileUrl` 会写入 HTML 的 `<img src>` 或 JSON 的 `src`。 |
| `convert` | 内置 EMF 转 PNG | 对不支持的光栅格式先调用此方法。返回 `{ bytes, mimeType }`，字节须为 PNG/JPEG/GIF/WebP；返回 `undefined` 时继续尝试内置 EMF 转换。 |
| `resolve` | 不设置 | 为可显示的普通光栅图片指定地址；仅在未配置 `processLargeImage` 时使用。 |

`ImageContext` 包含 `path`、`bytes`、`mimeType`、`alt`、`formula`（是否为 OLE 公式预览）。回调返回的图片地址会经过安全校验。

图片处理规则：

1. 配置了 `processLargeImage`：按 `base64ImageSize` 判断，小图强制 Base64，大图使用回调返回的地址；此时不调用 `resolve`。
2. 未配置 `processLargeImage`：普通光栅图片可用 `resolve` 指定地址，否则使用 Base64；单独设置 `base64ImageSize` 不会触发上传。
3. 生成的流程图、原生图表也遵循大小阈值和上传回调；OMML 公式图片走独立渲染逻辑，不经过 `imageHandler` 上传回调。

### 资源限制 `options.limits`

所有字段均为正整数，字节值可以写成 `50 * 1024 * 1024` 这样的表达式。

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `inputBytes` | `50 MiB` | 输入 DOCX 文件大小上限。 |
| `totalBytes` | `150 MiB` | ZIP 解压后的总资源大小上限。 |
| `entryBytes` | `40 MiB` | 单个 ZIP 条目解压后的大小上限。 |
| `entries` | `10000` | ZIP 条目数上限。 |
| `xmlDepth` | `128` | XML 嵌套深度上限。 |

### PDF 配置 `options.pdf`

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `pdf.format` | `'a4'` | `'a4'` 或 `'letter'`。 |
| `pdf.landscape` | `false` | 是否横向。 |
| `pdf.margin` | `15` | 四边页边距，单位毫米，范围 0–50。 |
| `pdf.scale` | `2` | 浏览器图像清晰度倍率，范围 1–4；Node 忽略。 |
| `pdf.executablePath` | 自动使用已安装的 Chrome | Node 可指定 Chrome / Edge 完整路径；浏览器忽略。 |

## 常见任务示例

下面各示例假设已从 `@agilehub/docx-converter` 导入所需方法，且 `file` 是浏览器中选择的 DOCX 文件。

### 预览 HTML 到 iframe

```ts
const result = await convertToHtml(file, { title: file.name });
const frame = document.querySelector<HTMLIFrameElement>('#preview')!;
frame.setAttribute('sandbox', '');
frame.srcdoc = result.html;
```

生成的完整 HTML 自带基础样式和内容安全策略，图片默认以 Data URI 内嵌，不依赖原始 DOCX 或 Blob URL。

### 下载 HTML / JSON / PDF

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
download(new Blob([html.html], { type: 'text/html;charset=utf-8' }), 'document.html');

const json = await convertToJson(file);
download(
  new Blob([JSON.stringify(json, null, 2)], { type: 'application/json;charset=utf-8' }),
  'document.json',
);

const pdf = await convertToPdf(file);
download(new Blob([pdf.bytes], { type: pdf.mimeType }), 'document.pdf');
```

### 上传大图片到自己的服务

```ts
const result = await convertToHtml(file, {
  imageHandler: {
    base64ImageSize: 512 * 1024, // 小于或等于 512 KiB 保持 Base64
    async processLargeImage(fileBlob, fileSuffix, fileName) {
      const form = new FormData();
      form.append('file', fileBlob, fileName);
      form.append('suffix', fileSuffix);

      const response = await fetch('/api/images', { method: 'POST', body: form });
      if (!response.ok) throw new Error('图片上传失败');
      const data = await response.json();

      return { fileUrl: data.file_url, fileSize: fileBlob.size, fileName };
    },
  },
});
```

回调收到的是**最终可显示**的图片 Blob，`fileSuffix` 不带点（例如 `png`）；如果图片经过 WMF/EMF 转换，后缀和文件名会变成转换后的格式。只有显式传入的处理器可能产生网络副作用，内置转换器不会读取 DOCX 中指向外部网络或本地文件的图片关系。

### 显示进度并支持取消

```ts
const controller = new AbortController();

const result = await convertToHtml(file, {
  signal: controller.signal,
  onProgress(event) {
    console.log(event.stage, event.completed, event.total);
  },
});

// 在别处请求取消：
controller.abort();
```

进度阶段依次为 `reading → extracting → parsing → rendering → complete`，只有成功后才发送 `complete`。同步 ZIP/XML 计算无法被同一线程中尚未执行的事件中断；需要强制终止时，应像演示页一样把转换放进 Web Worker 并 `terminate()`。

### 只在需要时输出语义 MathML

```ts
const result = await convertToHtml(file, { formulaOutput: 'mathml' });
```

默认的 `formulaOutput: 'image'` 会生成带 `data-latex` 的自包含 PNG 图片，适合直接展示和复制；`generatedImageOutput: 'svg'` 可保留矢量格式，`mathml` 则保留语义标记，适合需要自行排版或进一步处理的场景。

## 进阶用法

### 处理 WMF / EMF / TIFF / SVG 图片

DOCX 中的 **EMF 图片默认使用 [emf-converter](https://github.com/ChristopherVR/emf-converter) 转成 PNG**，HTML 与 JSON 都使用转换后的地址，原始 EMF 仍保留在 `resources` 中。若设置了 `imageHandler.convert(image)`，会优先使用自定义结果；未返回结果时再尝试内置 EMF 转换。

浏览器中可显式接入同时处理普通 WMF 和 EMF 的适配器：

```ts
import { convertToHtml } from '@agilehub/docx-converter';
import { convertMetafileImage } from '@agilehub/docx-converter/browser-metafile';

const result = await convertToHtml(file, {
  imageHandler: { convert: convertMetafileImage },
});
```

WMF、TIFF、SVG 等格式都可以通过 `imageHandler.convert` 接入自定义转换，返回 `{ bytes, mimeType }`（PNG/JPEG/GIF/WebP）。

Node 环境中，`emf-converter` 可直接转换不含文字的 EMF；含文字的 EMF 可能需要调用方安装其可选的 `@napi-rs/canvas` 后端或提供字体。核心库不会自动启动进程或上传文档。

### MathType / OLE 公式

MathType 公式若附带 WMF/EMF 预览，浏览器演示页会自动转成 PNG。可编辑 OLE 对象中的 `Equation Native` / MTEF 会由核心库解析；转换成功时公式图片包含 `data-latex="..."`。原有 `convertMathTypePreview` 仍可用于只处理公式预览的场景。

LaTeX 是从 OLE/MTEF **重建**的，不一定等于作者最初输入的源码。不支持的模板、损坏数据或与预览图明显不符的公式不会写入 `data-latex`，但图片仍会显示。

### Node 中使用 ImageMagick

安装 ImageMagick 后，可以显式启用本地进程适配器，并指定可信的可执行文件路径：

```ts
import { convertToHtmlFile, createImageMagickPreviewConverter } from '@agilehub/docx-converter/node';

const result = await convertToHtmlFile('demo.docx', {
  imageHandler: { convert: createImageMagickPreviewConverter('magick') },
});
```

此适配器只处理标记为公式的 WMF/EMF 预览。命令行示例可设置 `DOCX_MAGICK` 为 `magick` 或其绝对路径后运行 `node examples/node.mjs demo.docx demo.html`。

### OMML 公式的实现说明

默认输出 `<img src="data:image/png;base64,..." data-latex="...">`，可作为独立 HTML 打开，不需要外部字体文件或 MathJax 页面脚本。需要无损缩放时可设置 `generatedImageOutput: 'svg'`，此时输出自包含 SVG。公式字形使用 STIX Two Math（与 Word OMML 默认的 Cambria Math 同为衬线数学字体，字形接近但不完全相同；Cambria Math 是专有字体，无法随 MathJax 分发）。MathJax 的动态字体数据（积分号、双线字母、拉伸括号等扩展字形）会随构建产物一起打包，因此包体积比只含基础字形时大约多 1 MB。

公式图片使用公式节点标记：行内公式 class 为 `formula-item formula-image image-inline`，独立行公式 class 为 `formula-item formula-image image-block`；两种公式均使用 `data-type="formula"`。

### 原生图表、组合图形与 SmartArt

- **原生图表**：支持从 OOXML 图表缓存读取标准折线图和纵向簇状柱形图并生成图片，保留分类、数值坐标轴和缓存数据；HTML 和 JSON 均可使用。`generatedImageOutput` 默认为 `'png'`，可设为 `'svg'`。不重新计算嵌入工作簿；堆积图、百分比堆积图、横向条形图及复杂组合图尚未完整支持。
- **Word 组合图形**：支持 DrawingML 嵌套组合中的矩形、圆角矩形、椭圆、直线、向下箭头及三角连接箭头，并把文本框文字与图形一起生成图片。`drawingOutput` 默认继承 `generatedImageOutput`（即 PNG），可单独设为 `'svg'`：
- **SmartArt**：读取 Word 缓存的 `diagrams/drawing1.xml` 最终形状、旋转、文本和配色信息并生成图片，不尝试重新执行 SmartArt 布局引擎。

```ts
await convertToHtml(file);                        // 默认 PNG
await convertToHtml(file, { generatedImageOutput: 'svg' }); // 公式和图表使用 SVG
await convertToHtml(file, { drawingOutput: 'svg' });
await convertToJson(file, { drawingOutput: 'png' });
```

组合图形的 PNG 使用白色背景，默认按显示尺寸的 3 倍分辨率生成，超大图按最长边 8192 像素、约 1600 万像素的上限等比例降低倍率。栅格化失败时返回 `DRAWING_PNG_FAILED` 警告，不会静默改为 SVG。

## 错误、进度与取消

`convertToHtml` / `convertToJson` / `convertToPdf` 都返回 Promise：

- **文件结构错误、超出资源限制、图片回调抛错**等会使 Promise 拒绝；
- **内容兼容问题**通常进入 `warnings`，不会伪装成完整支持；
- `DocxError` 提供 `code` 和 `message`，可用于分支处理。

```ts
import { DocxError } from '@agilehub/docx-converter';

try {
  const result = await convertToHtml(file);
  for (const warning of result.warnings) console.warn(warning.code, warning.message);
} catch (error) {
  if (error instanceof DocxError) console.error(error.code, error.message);
  else throw error;
}
```

解析阶段的 `total` 表示顶层段落/表格数量，不代表图片上传或整项任务的百分比。

默认安全限制为：输入 50 MiB、解压总量 150 MiB、单条目 40 MiB、10000 个 ZIP 条目、XML 深度 128，可通过 `limits` 调整。XML 拒绝 DTD/实体；输出只由受控标签构建，链接协议和图片格式会校验。生产环境处理不可信大文件时，仍建议使用独立 Worker / 进程并设置内存和时间限制。

## 支持范围与已知限制

| 内容 | 已实现 | 边界 |
| --- | --- | --- |
| 字体 | 中文/西文字体、字号、颜色、粗斜体、下划线、删除线、上下标、高亮、底纹 | 不嵌入字体文件；设备缺少字体时由浏览器回退 |
| 样式 | docDefaults、basedOn 继承、段落/字符样式、主题字体和颜色 | 复杂条件表格样式、主题语言细分尚未完整覆盖 |
| 段落 | 对齐、常见缩进、间距、空行、换行、大纲标题 | 无像素级 Word 分页复刻；自定义制表位/分页/分栏未实现 |
| 标题 | 有效大纲级别 0–5 → h1–h6；显式正文阻断继承 | 不按样式名称猜测；单元格内统一 `p` |
| 列表 | 常见多级列表、起始编号和跨段落续号 | 自定义编号模板和复杂重启规则为近似显示 |
| 表格 | 直接子节点解析、嵌套表格、行列合并、宽度、底色、边框、三线表、单元格边距/对齐 | 自动分页、复杂行高/文字方向、条件样式未完整实现 |
| 图片 | 内嵌常规位图、EMF → PNG、尺寸、alt、Base64、自定义地址、图注 | 浮动图片按正文顺序显示；裁剪/旋转未完整实现 |
| OMML 公式 | 默认自包含 PNG + `data-latex`；可选 SVG 或 MathML；分式、根式、上下标、矩阵、方程组、重音、上下限等 | 不支持的结构保留可解析内容并警告，省略不可靠的 LaTeX |
| MathType / OLE | 保留原始对象和预览图；从 MTEF 3/5 保守重建 LaTeX | 模板支持有限；无法准确重建时省略 `data-latex` |
| 图形 / SmartArt | 组合图形、常见箭头、缓存 SmartArt 形状与文字；保留可用位图回退 | 复杂 3D、艺术效果和未生成预渲染绘图部件的 SmartArt 仍需占位 |
| 图注 / 表注 | 相邻“图 + 数字”→ `figure/figcaption`；“表 + 数字”→ `caption` | 规则匹配可能需要人工核对 |
| 修订与域 | 接受后的正文内容、文档保存的域结果 | 不重新计算域，不展示完整修订历史 |

其他限制：

- 只转换**正文**；页眉、页脚、脚注、尾注、批注部件会提示未包含；
- 不支持旧版 `.doc`、加密文件和 Strict OOXML；Strict 文档可先用 Word 另存为普通 DOCX；
- 浏览器 PDF 是栅格化结果，文字不可选中；Node PDF 默认依赖本机 Chrome，也可通过 `pdf.executablePath` 指定其他 Chromium 浏览器；
- 网络图片的加载取决于 CORS、协议和页面安全策略；
- 公式 LaTeX 是结构重建结果，不保证与作者输入完全一致。

## 常见问题

**安装 `@agilehub/docx-converter` 失败？**
请确认包名拼写正确，并执行 `npm install @agilehub/docx-converter`。如果所用镜像源尚未同步最新版本，可改用官方源安装（`npm install @agilehub/docx-converter --registry=https://registry.npmjs.org`），或在本仓库执行 `npm pack` 后用生成的 `.tgz` 安装。

**导出的 HTML 中中文或公式与 Word 不完全一致？**
库不嵌入字体文件，显示效果取决于运行环境已安装的字体。公式默认使用 STIX Two Math，字形接近 Word 的 Cambria Math，但不完全相同。

**浏览器导出的 PDF 文字不能选中？**
浏览器端通过分页栅格化生成 PDF。需要可搜索、可选中文字时，请在 Node.js 中使用 `convertToPdfFile`（需本机安装 Chrome）。

**页眉、页脚、脚注没有出现在结果中？**
当前只转换正文；页眉、页脚、脚注、尾注和批注会给出未包含的提示，但不会写入输出。

**网络地址转换失败？**
只接受 HTTP(S) 地址；浏览器还要求目标服务器允许 CORS，HTTPS 页面不能加载 HTTP 资源。下载失败会抛出 `FETCH_FAILED`。

## 开发与验证

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地演示（默认 5173）。 |
| `npm run check` | 架构检查 + 4 个 TypeScript 配置类型检查 + Vitest。 |
| `npm run build` | 构建 ESM/CJS/UMD、类型声明和演示应用。 |
| `npm run preview` | 预览构建后的演示应用（默认 4173）。 |
| `npm run test:e2e` | 针对构建后演示运行 Playwright 验收。 |
| `npm run verify` | `check + build + test:e2e`，CI 入口。 |
| `npm pack` | 构建并生成可安装的 tarball。 |

> **全新检出后第一次构建**：若仓库中没有 `dist/`，`npm run build` 可能在类型检查阶段找不到 `dist/node.js`。此时先生成库产物和类型声明，再执行完整构建：
>
> ```sh
> npx vite build --config vite.lib.config.ts
> npx tsc -p tsconfig.build.json
> npm run build
> ```

构建输出：

| 位置 | 用途 |
| --- | --- |
| `dist/index.js` / `index.cjs` | npm ESM / CommonJS 主入口 |
| `dist/node.js` / `node.cjs` | Node 文件路径入口 |
| `dist/browser-metafile.js` / `browser-metafile.cjs` | 浏览器 MathType 预览图转换适配器 |
| `dist/docx-converter.browser.js` | 浏览器 ESM 构建 |
| `dist/docx-converter.umd.cjs` | 内含依赖的 UMD 构建，暴露 `window.DocxConverter` |
| `dist/*.d.ts` | TypeScript 类型声明 |
| `dist-demo/` | 可部署到静态服务器的完整浏览器应用 |

`dist-demo` 使用相对资源路径，可部署在子路径；Worker 应通过 HTTP(S) 加载，不能直接双击入口文件运行。普通 script 示例位于 `examples/browser.html`，它直接调用库、不使用 Worker，适合小文件演示。

测试组织：

- `tests/fixtures/` 提供最小 DOCX、EMF、WMF、OLE/MTEF 构造器，以及 300 多个大学公式的 OMML 语料；
- `tests/unit/` 覆盖端口、模块边界和 Worker 生命周期；
- `tests/integration/` 覆盖公开转换行为、公式、表格、图片和失败边界；
- `tests/e2e/` 覆盖浏览器预览、下载、PDF、URL 输入和公式语料，运行前需要先构建演示，并执行 `npx playwright install chromium`，或把 `DOCX_TEST_BROWSER` 设置为本地 Chrome / Edge 的绝对路径。

`public/sample.docx` 是人工构造的可分发示例；可执行 `node scripts/generate-sample.ts` 在 Node 24 下重新生成。Windows 沙箱若限制默认临时目录，可把 `TEMP` / `TMP` 指向项目下的 `.tmp` 后再运行测试。

更多设计说明见 [架构文档](docs/architecture.md)，JSON 到 Tiptap 的字段映射和接入示例见 [Tiptap 接入指南](docs/json-tiptap-integration.md)，修改约定和工程检查见 [开发指南](CONTRIBUTING.md)。
