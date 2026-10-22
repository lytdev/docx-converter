# DOCX → HTML

使用 **TypeScript + Vite** 实现的 DOCX 转换库，提供 **npm 引入、Node.js 文件入口、浏览器页面、普通 script 标签** 四种调用方式。转换在本机执行，不依赖 Java、Word、服务器或在线公式服务。

实现参考相邻 Java 项目的分层方式：安全读取 DOCX → 解析 OOXML → 文档模型 → HTML。没有将 Mammoth 作为底层转换引擎，以便自行保留字体、表格边框和公式结构。

## 快速启动

开发环境：Node.js 22.12+（推荐 Node 24），npm。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，选择或拖入 DOCX；也可以点击“试用示例文档”。页面支持预览、源码、复制、下载完整 HTML 和资源 ZIP。OMML 公式默认渲染为自包含 SVG 图片并写入可提取的 `data-latex`；MathType/OLE 自带 WMF/EMF 预览时，页面会在 Web Worker 中将其转成 PNG 并嵌入 HTML，可解析的 OLE/MTEF 公式也会写入 `data-latex`。资源 ZIP 包含原始预览、OLE 对象和生成的 PNG；OMML 的 SVG 已内嵌在 HTML 中。页面支持取消和 60 秒超时终止。

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
| `dist/docx-html.umd.cjs` | 内含依赖的浏览器全局版本，暴露 `window.DocxHtml` |
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
import { convertDocx } from '@agile-hub/docx-html';

const file = document.querySelector<HTMLInputElement>('#file')!.files![0];
const result = await convertDocx(file, {
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

### Node.js 调用

```ts
import { writeFile } from 'node:fs/promises';
import { convertDocxFile } from '@agile-hub/docx-html/node';

const result = await convertDocxFile('report.docx');
await writeFile('report.html', result.html, 'utf8');
```

主入口也接受 Node Buffer（Uint8Array）。文件读写仅存在于 Node 入口和调用方代码，浏览器入口不引入 `node:fs`。

构建后可运行：

```sh
node examples/node.mjs public/sample.docx sample.html
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
      const result = await DocxHtml.convertDocx(file);
      document.getElementById('preview').srcdoc = result.html;
      console.log(result.warnings);
    } catch (error) {
      console.error(error);
    }
  };
</script>
```

## 图片扩展

默认把 PNG/JPEG/GIF/WebP 嵌入 Data URI，导出 HTML 不依赖原 DOCX 或 Blob URL。

业务需要上传图片时，传入异步处理器。调用方负责鉴权、上传和资源生命周期：

```ts
const result = await convertDocx(file, {
  images: {
    async resolve(image) {
      const form = new FormData();
      // Blob 需要普通 ArrayBuffer，复制也可兼容 SharedArrayBuffer 类型。
      form.append('file', new Blob([new Uint8Array(image.bytes)], {
        type: image.mimeType,
      }), image.path.split('/').pop());
      const response = await fetch('/api/images', { method: 'POST', body: form });
      if (!response.ok) throw new Error('图片上传失败');
      return (await response.json()).url;
    },
  },
});
```

只有显式传入的处理器可能产生网络副作用，内置转换器不会读取 DOCX 中指向外部网络或本地文件的图片关系。返回的 URL 会校验协议。

WMF/EMF/TIFF/SVG 等图片通过 `images.convert(image)` 显式接入格式转换，返回 `{bytes, mimeType}`（PNG/JPEG/GIF/WebP）。核心库不会自动启动进程或上传文档。转换后仍保留原始资源，图片解析器接收转换后的字节。

MathType 公式若附带 WMF/EMF 预览，浏览器应用会自动转成 PNG。可编辑 OLE 对象中的 `Equation Native` / MTEF 会由核心库解析；转换成功时公式图片包含 `data-latex="..."`。npm 库调用方可以显式引入同一浏览器图片适配器：

OMML 公式在 npm 库和浏览器页面中默认输出 `<img src="data:image/svg+xml;base64,..." data-latex="...">`，可作为独立 HTML 打开。仅在确实需要语义标记时传入 `{ formulaOutput: 'mathml' }`。生成的 SVG 无需外部字体文件或 MathJax 页面脚本；`data-latex` 是结构重建结果，遇到不支持的公式结构时省略。

```ts
import { convertDocx } from '@agile-hub/docx-html';
import { convertMathTypePreview } from '@agile-hub/docx-html/browser-metafile';

const result = await convertDocx(file, { images: { convert: convertMathTypePreview } });
```

Node.js 可在安装 ImageMagick 后显式启用本地进程适配器，并指定可信的可执行文件路径：

```ts
import { convertDocxFile, createImageMagickPreviewConverter } from '@agile-hub/docx-html/node';

const result = await convertDocxFile('demo.docx', {
  images: { convert: createImageMagickPreviewConverter('magick') },
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
| 图片 | 内嵌常规位图、尺寸、alt、Base64、自定义地址、图注 | 浮动图片按正文顺序显示；裁剪/旋转未完整实现 |
| OMML 公式 | 默认自包含 SVG 图片 + 可提取的 `data-latex`；可选 MathML 输出；分式、根式、上下标、前置上下标、大算符、定界符、矩阵、方程组、重音、上下划线、上下限、组合字符、函数 | 不支持结构保留可解析内容并警告，省略不可靠的 `data-latex`；LaTeX 是重建结果 |
| MathType/OLE | 保留原始对象和预览图，标记为公式；浏览器演示页自动将 WMF/EMF 预览转 PNG；从可编辑 OLE 的 MTEF 3/5 保守重建 LaTeX 并写入图片 `data-latex`；npm 可显式接入浏览器或 Node 图片适配器 | MTEF 模板只支持已实现的结构；缺少预览或图片转换失败时显示占位，无法准确重建时省略 `data-latex` |
| 图形/文本框 | 保留可用位图回退；文本框内容按正文展开 | DrawingML/VML 几何图形、图表、SmartArt 暂未转换为 SVG，显示占位与警告 |
| 图注/表注 | 相邻“图 + 数字”→ figure/figcaption；相邻“表 + 数字”→ caption | 规则匹配可能需要人工核对 |
| 修订与域 | 接受后的正文内容、文档保存的域结果 | 不重新计算域，不展示完整修订历史 |

当前仅转换正文；页眉、页脚、脚注、尾注、批注部件会提示未包含。不支持旧版 `.doc`、加密文件和 Strict OOXML；Strict 文档可另存为普通 DOCX 后转换。

## 错误、进度和取消

`convertDocx` 返回 Promise，文件结构错误、资源限制、图片回调异常等使 Promise 拒绝。`DocxError` 提供 `code` 和 `message`。内容兼容问题通常进入 `warnings`，不会伪装成完整支持。

进度依次为 `reading → extracting → parsing → rendering → complete`，只有成功后发送 complete。解析阶段 total 表示顶层段落/表格数量，不代表图片上传或整项任务百分比。

库接受 `AbortSignal`，在阶段边界和异步图片处理后检查取消。同步 ZIP/XML 计算无法被同一 JS 线程中尚未执行的事件中断；需要强制取消或超时时，应像演示页面一样使用 Worker 并 terminate。

默认限制：输入 50 MiB、解压总量 150 MiB、单条目 40 MiB、10000 个 ZIP 条目、XML 深度 128。可通过 `limits` 调整。读取 ZIP 实际输出时检查体积；XML 拒绝 DTD/实体，输出仅由受控标签构建，链接协议和图片格式有检查。XML 深度检查在 DOM 构建后执行，生产服务处理不可信大文件时应使用独立 Worker/进程并设置内存/时间限制。

## 开发与验证

- `src/` 按 contracts、domain、application、infrastructure、modules、rendering、adapters 分层；`apps/playground/` 放浏览器应用。
- `tests/fixtures/docx.ts`、`ole.ts` 和 `wmf.ts` 用最小合成文件生成测试数据；`tests/integration/` 覆盖字体继承、表格合并、嵌套表格、图片、公式、资源限制等行为；`tests/unit/` 覆盖 OLE/MTEF、模块隔离及 Worker 生命周期。
- `public/sample.docx` 是人工构造的可分发示例，不包含 Java 参考项目中的真实文档内容。
- `node scripts/generate-sample.ts` 可在 Node 24 下重新生成示例。
- `tests/e2e/` 为浏览器与下载验收，构建后运行 `npm run test:e2e`；首次运行需要安装 Playwright Chromium，或设置 `DOCX_TEST_BROWSER` 为本地 Chrome/Edge 的绝对路径。
- `npm run check:architecture` 检查模块边界与循环依赖；`npm run check` 同时执行架构、类型及 Vitest 检查；`npm run verify` 执行完整构建和浏览器验收。
- Windows 沙箱若限制默认临时目录，可把 `TEMP`/`TMP` 指向项目下的 `.tmp` 后运行测试。

模块划分、设计模式、依赖方向及 Java 对照见 [架构说明](docs/architecture.md)；功能归属和工程检查见 [开发指南](CONTRIBUTING.md)。
