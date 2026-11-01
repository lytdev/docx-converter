# DOCX → HTML / JSON

使用 **TypeScript + Vite** 实现的 DOCX 转换库，提供 **npm 引入、Node.js 文件入口、浏览器页面、普通 script 标签** 四种调用方式。HTML 与 JSON 输出共用 OOXML 解析后的文档模型。转换在本机执行，不依赖 Java、Word、服务器或在线公式服务。

实现分层读取方式：安全读取 DOCX → 解析 OOXML → 文档模型 → HTML / JSON。没有将 Mammoth 作为底层转换引擎，以便自行保留字体、表格边框和公式结构。

## 导出 PDF

`convertToPdf(input, options?)` 支持与 HTML/JSON 相同的 DOCX 二进制和 HTTP(S) 地址，返回 `{ bytes: Uint8Array, mimeType: 'application/pdf', warnings, resources, stats }`。第二个参数支持已有转换选项，并可增加 `pdf`：

| 参数 | 默认值 | 用法 |
| --- | --- | --- |
| `pdf.format` | `'a4'` | `'a4'` 或 `'letter'`。 |
| `pdf.landscape` | `false` | 是否横向。 |
| `pdf.margin` | `15` | 四边页边距，毫米，范围 0–50。 |
| `pdf.scale` | `2` | 浏览器图像清晰度倍率，范围 1–4；Node 忽略。 |
| `pdf.executablePath` | 自动使用已安装的 Chrome | Node 可指定 Chrome/Edge 完整路径；浏览器忽略。 |

```ts
import { convertToPdf } from '@agile-hub/docx-html';
const result = await convertToPdf(fileOrUrl, { pdf: { format: 'a4', margin: 15 } });
const url = URL.createObjectURL(new Blob([result.bytes], { type: result.mimeType }));
const a = document.createElement('a'); a.href = url; a.download = 'document.pdf'; a.click();
setTimeout(() => URL.revokeObjectURL(url), 5000);
// 普通 script 标签：DocxConvert.convertToPdf(fileOrUrl, options)
```

```ts
import { convertToPdfFile } from '@agile-hub/docx-html/node';
import { writeFile } from 'node:fs/promises';
const result = await convertToPdfFile('./demo.docx', {
  pdf: { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
});
await writeFile('./demo.pdf', result.bytes);
```

浏览器需要在主线程、有 DOM 的页面中调用；普通 script 示例 `examples/browser.html` 提供“下载 PDF”。浏览器将 HTML 分页栅格化，文字不可直接选中或搜索，大文档受 Canvas 尺寸和内存限制；Node 使用 Chromium 打印，保留可选中文字，运行机器需安装 Chrome 或通过 `executablePath` 指定浏览器。两者复用当前 HTML 转换结果，未实现 Word 原始分页、页眉页脚的完整还原，分页和字体效果依赖渲染环境；远程图片还受 CORS/加载权限影响。`output` 对 PDF 无效，内部总是生成完整 HTML。`signal` 支持检查点取消，浏览器栅格化阶段不能立即中断。上传回调若返回网络图片地址，导出时需能访问该地址。

## 转换 API 与参数速查

**转换配置统一放在第二个参数 `options` 中，可省略。** HTML、JSON、浏览器全局调用及 Node 文件入口使用相同的 `ConversionOptions`。

```ts
// npm：import { convertToHtml, convertToJson } from '@agile-hub/docx-html'
convertToHtml(input, options?)     // Promise<ConversionResult>，HTML 在 result.html
convertToJson(input, options?)     // Promise<JsonConversionResult>，结构在 result.document

// 普通 script 标签：使用 window.DocxConvert
DocxConvert.convertToHtml(input, options?)
DocxConvert.convertToJson(input, options?)

// Node：从 '@agile-hub/docx-html/node' 引入
convertToHtmlFile(path, options?)
convertToJsonFile(path, options?)
```

### 第一个参数：文档输入

| 参数 | 类型 | 含义与用法 |
| --- | --- | --- |
| `input` | `string \| Blob \| ArrayBuffer \| Uint8Array` | DOCX 二进制内容。浏览器可直接传文件选择器得到的 `File`；Node 可传 `readFile` 返回的 `Buffer`（属于 `Uint8Array`）。字符串支持完整 HTTP(S) DOCX 地址；不支持直接传本地文件路径。 |
| `path`（仅 `*File` 方法） | `string` | 本机 DOCX 文件路径，例如 `'./demo.docx'`；辅助方法负责读取文件并调用转换器。 |

### 网络文件地址

```ts
const url = 'https://oss.cxgdxjc.com/file/3d7a52da50af4b84b613d7b93fe0bba0.docx';
const html = await convertToHtml(url, { drawingOutput: 'png' });
const json = await convertToJson(url, { imageHandler: { base64ImageSize: 2048 } });
// script 标签调用：DocxConvert.convertToHtml(url, options)
```

每次调用会下载文档，再按原有流程转换。下载遵循 `limits.inputBytes` 和 `signal`；流式检查大小，即使服务器没有 Content-Length 也会限制下载。只接受 HTTP(S) 地址，下载失败抛出 `FETCH_FAILED`。浏览器跨域下载要求文件服务器允许 CORS，HTTPS 页面还受浏览器混合内容规则限制；不会自动使用代理。示例页面支持输入网络地址并预览、下载 HTML/JSON。

### 第二个参数：转换选项 `options`

| 参数 | 类型 / 可选值 | 默认值 | 含义与用法 |
| --- | --- | --- | --- |
| `output` | `'document' \| 'fragment'` | `'document'` | HTML 输出范围：完整 HTML 页面，或可嵌入页面的正文片段。对 JSON 无影响。 |
| `title` | `string` | `'DOCX 转换文档'` | 完整 HTML 页面的 `<title>`；不修改正文标题。对 JSON、HTML 片段无影响。 |
| `formulaOutput` | `'image' \| 'mathml'` | `'image'` | OMML 公式输出方式。`image` 生成带 `data-latex` 的 SVG 图片；JSON 公式节点提供 SVG `src`。`mathml` 保留 MathML，不生成公式 SVG。LaTeX 仅在公式结构可完整解析时提供。 |
| `drawingOutput` | `'png' \| 'svg'` | `'png'` | Word 组合流程图的图片格式。PNG 默认按显示尺寸的 3 倍生成，超大图受像素上限约束；SVG 为矢量输出。此选项不控制公式、原生图表或普通嵌入图片。 |
| `imageHandler` | 图片配置对象，见下表 | 不上传，内嵌 Base64 | 控制图片格式转换、Base64 阈值和自定义上传。 |
| `onProgress` | `(event) => void` | 不回调 | 接收转换进度。`event.stage` 为 `reading`、`extracting`、`parsing`、`rendering` 或 `complete`；`completed`、`total` 为可选字段，不保证每个阶段都有。 |
| `signal` | `AbortSignal` | 不设置取消信号 | 传入 `AbortController.signal`，调用 `controller.abort()` 请求取消。转换器在检查点响应；不会强制终止正在执行的用户上传回调。 |
| `limits` | `Partial<ConversionLimits>`，见下表 | 使用内置限制 | 限制输入大小、解压资源和 XML 深度；仅覆盖传入的字段。 |

### 图片配置 `options.imageHandler`

**图片大小指最终可显示文件的字节数，不是宽高，也不是 Base64 字符串长度。** 格式转换先执行，再按字节大小决定是否上传。

| 参数 | 类型 | 默认值 | 含义与用法 |
| --- | --- | --- | --- |
| `base64ImageSize` | 非负整数 | `2048`（2 KB） | 图片小于或等于此值时，即使提供 `processLargeImage` 也使用 Base64；严格大于此值才调用上传回调。`0` 表示所有非空图片都可交给上传回调。 |
| `processLargeImage` | `(fileBlob: Blob, fileSuffix: string, fileName: string) => ProcessedImage \| Promise<ProcessedImage>` | 不设置 | 自定义大图上传。返回 `{ fileUrl, fileSize?, fileName? }`，核心使用 `fileUrl` 填充 HTML 图片地址或 JSON `src`。`fileSuffix` 不带点，例如 `png`。 |
| `convert` | `(image: ImageContext) => ImageResult \| undefined \| Promise<ImageResult \| undefined>` | 内置 EMF 转 PNG | 普通图片不是受支持的光栅格式时，先调用此方法。返回 `{ bytes: Uint8Array, mimeType: string }`，字节需为 PNG/JPEG/GIF/WebP；返回 `undefined` 时继续尝试内置 EMF 转换。不控制内部生成的流程图、图表或 OMML 公式。 |
| `resolve` | `(image: ImageContext) => string \| Promise<string>` | 不设置 | 为可显示的普通光栅图片指定地址；仅未配置 `processLargeImage` 时使用。内部生成的流程图、图表及 OMML 公式不调用此接口。 |

`ImageContext` 包含 `path`（资源路径）、`bytes`（二进制）、`mimeType`、`alt`、`formula`（是否 OLE 公式预览）。回调返回的图片地址会经过安全校验。

图片处理规则：

1. 配置 `processLargeImage`：按 `base64ImageSize` 判断，小图强制 Base64，大图使用回调返回的地址；此时不调用 `resolve`。
2. 未配置 `processLargeImage`：普通光栅图片可用 `resolve` 指定地址，否则 Base64；单独设置 `base64ImageSize` 不会触发上传。
3. 生成的流程图、原生图表也遵循大小阈值和上传回调。OMML 公式图片走独立公式渲染逻辑，当前不经过 `imageHandler` 上传回调。

### 资源限制 `options.limits`

所有字段均为正整数；字节值可以使用 `50 * 1024 * 1024` 这样的表达式。

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `inputBytes` | `50 * 1024 * 1024`（50 MiB） | 输入 DOCX 文件大小上限。 |
| `totalBytes` | `150 * 1024 * 1024`（150 MiB） | ZIP 解压后的总资源大小上限。 |
| `entryBytes` | `40 * 1024 * 1024`（40 MiB） | 单个 ZIP 条目解压后的大小上限。 |
| `entries` | `10000` | ZIP 条目数上限。 |
| `xmlDepth` | `128` | XML 嵌套深度上限。 |

### 常用配置示例

```ts
import { convertToHtml, convertToJson, type ConversionOptions } from '@agile-hub/docx-html';

const controller = new AbortController();
const options: ConversionOptions = {
  output: 'document',
  title: '文档预览',
  formulaOutput: 'image',
  drawingOutput: 'png', // 改为 'svg' 可输出矢量流程图
  imageHandler: {
    base64ImageSize: 2 * 1024, // 可改为 10 * 1024 等；省略时也是 2 KB
    async processLargeImage(fileBlob, fileSuffix, fileName) {
      const form = new FormData();
      form.append('file', fileBlob, fileName);
      form.append('suffix', fileSuffix);
      const response = await fetch('/api/images', { method: 'POST', body: form });
      if (!response.ok) throw new Error('图片上传失败');
      const data = await response.json(); // 根据实际服务响应调整字段
      return { fileUrl: data.file_url, fileSize: fileBlob.size, fileName };
    },
  },
  onProgress(event) { console.log(event.stage, event.completed, event.total); },
  signal: controller.signal,
  limits: { inputBytes: 50 * 1024 * 1024 },
};

// file 为浏览器选择的 DOCX File，或 Node 中读取的 Buffer
const htmlResult = await convertToHtml(file, options);
const jsonResult = await convertToJson(file, options);
// 两次调用分别转换，上传回调也分别执行。
// 取消正在进行的转换：controller.abort();
```

不需要上传时可直接 `convertToHtml(file)` 或 `convertToJson(file)`。两个方法均返回 Promise：成功后检查 `warnings` 获取降级提示；读取、限制校验或回调执行等异常使用 `try/catch` 处理。各运行环境的引入方法和返回值结构见下文。

## 快速启动

开发环境：Node.js 22.12+（推荐 Node 24），npm。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，选择或拖入 DOCX；也可以点击“试用示例文档”。页面支持预览、源码、复制、下载完整 HTML、结构化 JSON 和资源 ZIP。普通 EMF 图片会转成 PNG；OMML 公式默认渲染为自包含 SVG 图片并写入可提取的 `data-latex`；MathType/OLE 自带 WMF/EMF 预览时，页面会在 Web Worker 中将其转成 PNG 并嵌入 HTML，可解析的 OLE/MTEF 公式也会写入 `data-latex`。资源 ZIP 包含原始图片、OLE 对象和生成的 PNG；OMML 的 SVG 已内嵌在 HTML 中。页面支持取消和 60 秒超时终止。

```sh
npm run check
npm run build
npm run preview
```

构建输出：

| 位置 | 用途 |
| --- | --- |
| `dist/index.js` / `index.cjs` | npm ESM / CommonJS 主入口 |
| `dist/node.js` / `node.cjs` | Node 文件路径入口 |
| `dist/browser-metafile.js` / `browser-metafile.cjs` | 浏览器 MathType 预览图转换适配器 |
| `dist/*.d.ts` | TypeScript 类型声明 |
| `dist/docx-html.umd.cjs` | 内含依赖的浏览器全局版本，暴露 `window.DocxConvert` |
| `dist-demo/` | 可部署到静态服务器的完整浏览器应用 |

`dist-demo` 使用相对资源路径，可部署在子路径。Worker 应通过 HTTP(S) 加载，不能依赖直接双击应用入口。普通 script 示例位于 `examples/browser.html`；它直接调用库，不使用 Worker，适合小文件演示。

## npm 插件 / 库使用方式

包名暂定为 `@agile-hub/docx-html`，**尚未发布 npm**。先本地打包：

```sh
npm pack
```

然后在其他项目中安装生成的包：

```sh
npm install /absolute/path/agile-hub-docx-html-0.1.0.tgz
```

在 Vite、Vue、React 或其他 TypeScript / JavaScript 项目中均可调用，不绑定 UI 框架：

```ts
import { convertToHtml } from '@agile-hub/docx-html';

const file = document.querySelector<HTMLInputElement>('#file')!.files![0];
const result = await convertToHtml(file, {
  output: 'document', // 默认；可设为 'fragment'
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

**返回值：**

```ts
interface ConversionResult {
  html: string;
  warnings: { code: string; message: string; part?: string }[];
  resources: { path: string; mimeType: string; bytes: Uint8Array }[];
  stats: { paragraphs: number; tables: number; images: number; formulas: number };
}
```

`resources` 包括被引用的原始图片及 OLE 文件，即使图片不能显示也会保留。转换后的 PNG 嵌入 HTML；浏览器演示页还会将其单独导出到资源 ZIP。统计包含表格内段落和嵌套表格；解析进度的 total 只统计顶层内容块，两者用途不同。

### 导出 JSON

`convertToJson` 与 `convertToHtml` 接受**相同的输入和 `ConversionOptions`**。两者共用解析器及文档结构，JSON 出口在结构树中填充可显示图片的 `src`；大图上传回调、格式转换、取消、进度与安全 URL 校验同样生效。`formulaOutput: 'image'`（默认）时，OMML 公式节点同时包含 MathML、可提取的 LaTeX 和自包含 SVG `src`；设为 `'mathml'` 时不生成 SVG。

```ts
import { convertToJson, type JsonConversionResult } from '@agile-hub/docx-html';

const result: JsonConversionResult = await convertToJson(file, {
  imageHandler: { base64ImageSize: 512 * 1024 }, // 按需加入下文的 processLargeImage 回调
});
const jsonText = JSON.stringify(result, null, 2);
console.log(result.document.blocks, result.warnings);
```

`result.document.blocks` 是按原文顺序排列的段落与表格；表格单元格内仍是 `blocks`，段落内的 `children` 包括文字、图片、公式、链接等节点。JSON 保留原始相邻段落，HTML 展示时可将图注、表注合并到图表元素。图片节点保留 `path`、尺寸、样式和解析后的 `src`，不支持或缺失的图片没有 `src` 并产生诊断。JSON 结果的 `resources` 只包含原始资源的 `path`、`mimeType`、`size`，因此整个返回值可直接序列化；如需原始二进制资源，使用 `convertToHtml` 的 `resources`。`output` 和 `title` 是 HTML 包装选项，对 JSON 文档树没有影响。

普通浏览器 script 标签也可调用 `DocxConvert.convertToJson(file, options)`；`examples/browser.html` 提供下载 JSON 的示例。npm 主入口与 UMD 包均导出此方法。

### Node.js 调用

```ts
import { writeFile } from 'node:fs/promises';
import { convertToHtmlFile, convertToJsonFile } from '@agile-hub/docx-html/node';

const html = await convertToHtmlFile('report.docx');
const json = await convertToJsonFile('report.docx');
await writeFile('report.html', html.html, 'utf8');
await writeFile('report.json', JSON.stringify(json, null, 2), 'utf8');
```

Node 文件路径方法与浏览器/主入口的 `convertToHtml(input, options)`、`convertToJson(input, options)` 一一对应，参数中的 `options` 类型相同。主入口也接受 Node Buffer（Uint8Array）。文件读取仅存在于 Node 入口，输出文件由调用方写入；浏览器入口不引入 `node:fs`。

构建后可运行：

```sh
node examples/node.mjs public/sample.docx sample.html
node examples/node.mjs public/sample.docx sample.json
```

### 普通浏览器 script 引入

将构建文件复制到网站的 `/assets/` 目录。若服务器不识别 `.cjs` 的 JavaScript MIME，可将它复制并命名为 `docx-html.js`。

```html
<input id="file" type="file" accept=".docx">
<iframe id="preview" sandbox="" title="文档预览"></iframe>
<script src="/assets/docx-html.js"></script>
<script>
  document.getElementById('file').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const result = await DocxConvert.convertToHtml(file);
      document.getElementById('preview').srcdoc = result.html;
      console.log(result.warnings);
      // 导出结构数据时，使用同一组选项调用：
      const json = await DocxConvert.convertToJson(file);
      console.log(json.document.blocks);
    } catch (error) {
      console.error(error);
    }
  };
</script>
```

## 图片扩展

默认把 PNG/JPEG/GIF/WebP 嵌入 Base64 Data URI，导出 HTML 不依赖原 DOCX 或 Blob URL。需要只上传大图片时，设置字节阈值和异步回调：

```ts
const result = await convertToHtml(file, {
  imageHandler: {
    base64ImageSize: 512 * 1024, // 小于或等于 512 KiB 的图片保持 Base64
    async processLargeImage(fileBlob, fileSuffix, fileName) {
      const form = new FormData();
      form.append('file', fileBlob, fileName);
      form.append('suffix', fileSuffix); // png、jpg、jpeg、gif 或 webp
      const response = await fetch('/api/images', { method: 'POST', body: form });
      if (!response.ok) throw new Error('图片上传失败');
      const data = await response.json();
      return { fileUrl: data.file_url, fileSize: fileBlob.size, fileName };
    },
  },
});
```

回调接收最终可显示的图片 Blob，`fileSuffix` 不带点，`fileName` 来自 DOCX 图片文件名；如果图片经过 WMF/EMF 等格式转换，后缀与文件名会改为转换后的格式。阈值按转换后的图片字节数判断，**只有大于** `base64ImageSize` 才调用回调。HTML 的 `<img src>` 使用返回的 `fileUrl`；`fileSize` 和 `fileName` 可供调用方记录。不传阈值时默认使用 2048 字节（2 KB）；配置回调后，小于或等于阈值的图片强制使用 Base64，超过阈值才调用回调。未提供回调时保持 Base64；旧接口 `imageHandler.resolve` 单独配置时遵循其原有行为。阈值必须是非负整数字节数，设为 `0` 可处理全部图片。

浏览器普通 script 标签同样传入该选项：`DocxConvert.convertToHtml(file, { imageHandler: { base64ImageSize, processLargeImage } })`。页面示例位于 `examples/browser.html`；若在 Web Worker 中执行转换，上传回调应定义在 Worker 内或通过消息协议转交主线程。已有的 `imageHandler.resolve(image)` 仍可用于**不区分大小**地为每张可显示图片指定 URL；同时配置大小回调与 `resolve` 时，按大小回调规则处理，大图使用回调，小图保持 Base64。

只有显式传入的处理器可能产生网络副作用，内置转换器不会读取 DOCX 中指向外部网络或本地文件的图片关系。返回的 URL 会校验协议，非法地址不会写入 HTML。

DOCX 中的 **EMF 图片默认使用 [emf-converter](https://github.com/ChristopherVR/emf-converter) 转成 PNG**，HTML 的 `<img src>` 和 JSON 图片节点的 `src` 均使用转换后的地址；原始 EMF 仍保留在 `resources`。若设置 `imageHandler.convert(image)`，优先使用自定义结果；未返回结果时再尝试内置 EMF 转换。随后才按转换后的 PNG 字节数判断 `base64ImageSize`，大图上传回调收到 `image/png`、`png` 后缀和 `.png` 文件名。浏览器演示页还会转换普通 WMF，并在资源 ZIP 中提供生成的 PNG。无法转换时保持原始文件及 `UNSUPPORTED_IMAGE` 提示。

Node 环境中，[emf-converter](https://github.com/ChristopherVR/emf-converter#install) 可直接转换不含文字的 EMF；含文字的 EMF 可能需要调用方安装其可选的 `@napi-rs/canvas` 后端或提供字体，否则转换器会返回空结果。WMF、TIFF、SVG 等仍可通过 `imageHandler.convert(image)` 接入自定义格式转换，返回 `{bytes, mimeType}`（PNG/JPEG/GIF/WebP）。核心库不会自动启动进程或上传文档。

MathType 公式若附带 WMF/EMF 预览，浏览器应用会自动转成 PNG。可编辑 OLE 对象中的 `Equation Native` / MTEF 会由核心库解析；转换成功时公式图片包含 `data-latex="..."`。npm 库调用方可显式引入同时处理普通 WMF 和 EMF 的图片适配器：

```ts
import { convertToHtml } from '@agile-hub/docx-html';
import { convertMetafileImage } from '@agile-hub/docx-html/browser-metafile';

const result = await convertToHtml(file, { imageHandler: { convert: convertMetafileImage } });
```

原有 `convertMathTypePreview` 仍可用于只处理公式预览的场景。

OMML 公式在 npm 库和浏览器页面中默认输出 `<img src="data:image/svg+xml;base64,..." data-latex="...">`，可作为独立 HTML 打开。仅在确实需要语义标记时传入 `{ formulaOutput: 'mathml' }`。生成的 SVG 无需外部字体文件或 MathJax 页面脚本；`data-latex` 是结构重建结果，遇到不支持的公式结构时省略。

Node.js 可在安装 ImageMagick 后显式启用本地进程适配器，并指定可信的可执行文件路径：

```ts
import { convertToHtmlFile, createImageMagickPreviewConverter } from '@agile-hub/docx-html/node';

const result = await convertToHtmlFile('demo.docx', {
  imageHandler: { convert: createImageMagickPreviewConverter('magick') },
});
```

命令行示例可设置 `DOCX_MAGICK` 为 `magick` 或其绝对路径后运行 `node examples/node.mjs demo.docx demo.html`。此适配器只处理标记为公式的 WMF/EMF 预览；其他格式仍可由调用方自定义。若预览不存在或转换失败，输出保留原始资源并给出兼容性警告。LaTeX 是从 OLE/MTEF **重建**的，不一定等于作者最初输入的源码；图片本身不能可靠还原 LaTeX。不支持的模板、损坏数据或与预览图明显不符的公式不会写入 `data-latex`，但图片仍会显示。

## 支持范围

| 内容 | 已实现 | 边界 |
| --- | --- | --- |
| 字体 | 中文/西文字体、字号、颜色、粗斜体、下划线、删除线、上下标、高亮、底纹 | 不嵌入字体文件；设备缺少字体时由浏览器回退；OOXML toggle 样式采用显式值覆盖近似 |
| 样式 | docDefaults、basedOn 继承、段落/字符样式、主题字体和颜色 | 复杂条件表格样式、主题语言细分尚未完整覆盖 |
| 段落 | 对齐、常见缩进、间距、空行、换行、大纲标题 | 无像素级 Word 分页复刻；自定义制表位/分页/分栏未实现 |
| 标题 | 有效大纲级别 0–5 → h1–h6；显式正文阻断继承 | 不按样式名称猜测；单元格内统一 p |
| 列表 | 常见多级列表、起始编号和跨段落续号 | 自定义编号模板和复杂重启规则为近似显示，复杂模板有警告 |
| 表格 | 直接子节点解析、嵌套表格、行列合并、宽度、底色、边框、三线表、单元格边距/对齐 | 自动分页、复杂行高/文字方向、条件样式未完整实现 |
| 图片 | 内嵌常规位图、EMF → PNG、尺寸、alt、Base64、自定义地址、图注 | 浮动图片按正文顺序显示；裁剪/旋转未完整实现；Node 含文字 EMF 可能需额外字体/画布后端 |
| OMML 公式 | 默认自包含 SVG 图片 + 可提取的 `data-latex`；可选 MathML 输出；分式、根式、上下标、前置上下标、大算符、定界符、矩阵、方程组、重音、上下划线、上下限、组合字符、函数 | 不支持结构保留可解析内容并警告，省略不可靠的 `data-latex`；LaTeX 是重建结果 |
| MathType/OLE | 保留原始对象和预览图，标记为公式；浏览器演示页自动将 WMF/EMF 预览转 PNG；从可编辑 OLE 的 MTEF 3/5 保守重建 LaTeX 并写入图片 `data-latex`；npm 可显式接入浏览器或 Node 图片适配器 | MTEF 模板只支持已实现的结构；缺少预览或图片转换失败时显示占位，无法准确重建时省略 `data-latex` |
| 图形/文本框 | 保留可用位图回退；文本框内容按正文展开 | DrawingML/VML 几何图形、图表、SmartArt 暂未转换为 SVG，显示占位与警告 |
| 图注/表注 | 相邻“图 + 数字”→ figure/figcaption；相邻“表 + 数字”→ caption | 规则匹配可能需要人工核对 |
| 修订与域 | 接受后的正文内容、文档保存的域结果 | 不重新计算域，不展示完整修订历史 |

当前仅转换正文；页眉、页脚、脚注、尾注、批注部件会提示未包含。不支持旧版 `.doc`、加密文件和 Strict OOXML；Strict 文档可另存为普通 DOCX 后转换。

## 错误、进度和取消

`convertToHtml` 返回 Promise，文件结构错误、资源限制、图片回调异常等使 Promise 拒绝。`DocxError` 提供 `code` 和 `message`。内容兼容问题通常进入 `warnings`，不会伪装成完整支持。

进度依次为 `reading → extracting → parsing → rendering → complete`，只有成功后发送 complete。解析阶段 total 表示顶层段落/表格数量，不代表图片上传或整项任务百分比。

库接受 `AbortSignal`，在阶段边界和异步图片处理后检查取消。同步 ZIP/XML 计算无法被同一 JS 线程中尚未执行的事件中断；需要强制取消或超时时，应像演示页面一样使用 Worker 并 terminate。

默认限制：输入 50 MiB、解压总量 150 MiB、单条目 40 MiB、10000 个 ZIP 条目、XML 深度 128。可通过 `limits` 调整。读取 ZIP 实际输出时检查体积；XML 拒绝 DTD/实体，输出仅由受控标签构建，链接协议和图片格式有检查。XML 深度检查在 DOM 构建后执行，生产服务处理不可信大文件时应使用独立 Worker/进程并设置内存/时间限制。

## 开发与验证

- `src/` 按 contracts、domain、application、infrastructure、modules、rendering、adapters 分层；`apps/playground/` 放浏览器应用。
- `tests/fixtures/docx.ts`、`emf.ts`、`ole.ts` 和 `wmf.ts` 提供最小测试数据；`tests/integration/` 覆盖字体继承、表格合并、嵌套表格、图片、公式、资源限制等行为；`tests/unit/` 覆盖 OLE/MTEF、模块隔离及 Worker 生命周期。
- `public/sample.docx` 是人工构造的可分发示例，不包含 Java 参考项目中的真实文档内容。
- `node scripts/generate-sample.ts` 可在 Node 24 下重新生成示例。
- `tests/e2e/` 为浏览器与下载验收，构建后运行 `npm run test:e2e`；首次运行需要安装 Playwright Chromium，或设置 `DOCX_TEST_BROWSER` 为本地 Chrome/Edge 的绝对路径。
- `npm run check:architecture` 检查模块边界与循环依赖；`npm run check` 同时执行架构、类型及 Vitest 检查；`npm run verify` 执行完整构建和浏览器验收。
- Windows 沙箱若限制默认临时目录，可把 `TEMP`/`TMP` 指向项目下的 `.tmp` 后运行测试。

模块划分、设计模式、依赖方向及 Java 对照见 [架构说明](docs/architecture.md)；功能归属和工程检查见 [开发指南](CONTRIBUTING.md)。

原生图表：支持从 OOXML 图表缓存读取标准折线图并生成 SVG 图片，保留分类、曲线、数值坐标轴及数据表；HTML 和 JSON 均可使用。此能力不依赖 EMF 预览，也不重新计算嵌入工作簿。其他图表类型、组合图、堆积图及复杂样式尚未完整支持。图表图片超过上传阈值时，图片回调接收 SVG Blob 和 svg 后缀。

Word 组合图形：支持 DrawingML 嵌套组合中的矩形、圆角矩形、椭圆、直线及三角箭头，将文本框文字和图形一起生成图片。第二个参数 `drawingOutput` 默认为 `'png'`，可指定 `'svg'`；HTML、JSON 和 Node 文件辅助方法共用配置。此选项仅控制组合图形，不改变公式或原生图表的格式。

```ts
await convertToHtml(file); // 默认 PNG
await convertToHtml(file, { drawingOutput: 'svg' });
await convertToJson(file, { drawingOutput: 'png' });
// Node 入口同样支持：convertToHtmlFile(path, { drawingOutput: 'svg' })
//                    convertToJsonFile(path, { drawingOutput: 'png' })
```

PNG 使用白色背景，默认按显示尺寸的 3 倍分辨率生成，HTML/JSON 中的显示尺寸不变；超大图按最长边 8192 像素、约 1600 万像素的上限等比例降低倍率。浏览器使用 Canvas（Worker 使用 OffscreenCanvas），Node 使用依赖 `@napi-rs/canvas`，中文字体需运行环境提供。栅格化失败时返回 `DRAWING_PNG_FAILED` 警告，不静默改为 SVG。`imageHandler.processLargeImage` 在格式转换后检查最终字节大小，接收与输出格式一致的 Blob、后缀和文件名；未提供回调时使用 Base64。

保留组合坐标缩放和连接线方向，文字按文本框宽度近似换行；复杂字体混排、主题样式、旋转、自定义路径和其他形状尚未完整支持。遇到不支持的组合结构时返回 `UNSUPPORTED_GROUP_DRAWING` 警告并保留可读取的文本框文字，不再输出空图片占位。
