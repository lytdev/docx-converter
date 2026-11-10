# 进阶能力

本文介绍网络地址输入、图片处理、公式、绘制图形和图表等扩展能力。基础调用和参数见 [README](../README.md)。

## 网络地址转换

主入口的 `input` 可以是完整的 HTTP(S) DOCX 地址：

```ts
const url = 'https://example.com/document.docx';

const html = await convertToHtml(url, { drawingOutput: 'png' });
const json = await convertToJson(url, {
  imageHandler: { base64ImageSize: 2048 },
});
```

每次调用都会重新下载文档。下载遵循 `limits.inputBytes` 和 `signal`；即使服务器没有返回 `Content-Length`，也会在流式读取时检查大小。只接受 HTTP(S)，本地文件和 `file://` 地址不会读取。下载失败会抛出 `FETCH_FAILED`。

浏览器跨域下载要求文件服务器允许 CORS，HTTPS 页面还受混合内容规则限制，库不会自动使用代理。

## 图片与图形

### 大图片上传

图片处理在格式转换之后执行，再按最终文件字节数判断是否保持 Base64 或交给上传回调：

```ts
const result = await convertToHtml(file, {
  imageHandler: {
    base64ImageSize: 512 * 1024,
    async processLargeImage(fileBlob, fileSuffix, fileName) {
      const form = new FormData();
      form.append('file', fileBlob, fileName);
      form.append('suffix', fileSuffix);

      const response = await fetch('/api/images', {
        method: 'POST',
        body: form,
      });
      if (!response.ok) throw new Error('图片上传失败');

      const data = await response.json();
      return {
        fileUrl: data.file_url,
        fileSize: fileBlob.size,
        fileName,
      };
    },
  },
});
```

回调收到的是最终可显示的图片 Blob，`fileSuffix` 不带点（例如 `png`）。如果图片经过 WMF/EMF 转换，后缀和文件名会变成转换后的格式。只有显式传入的处理器可能产生网络副作用，内置转换器不会读取 DOCX 中指向外部网络或本地文件的图片关系。

图片处理顺序：

1. 配置了 `processLargeImage`：按 `base64ImageSize` 判断，小图强制 Base64，大图使用回调返回的地址；此时不调用 `resolve`。
2. 未配置 `processLargeImage`：普通光栅图片可用 `resolve` 指定地址，否则使用 Base64；单独设置 `base64ImageSize` 不会触发上传。
3. 生成的流程图、原生图表也遵循大小阈值和上传回调；OMML 公式图片走独立渲染逻辑，不经过 `imageHandler` 上传回调。

### WMF / EMF / TIFF / SVG

DOCX 中的 EMF 图片默认使用 [emf-converter](https://github.com/ChristopherVR/emf-converter) 转成 PNG，HTML 和 JSON 都使用转换后的地址，原始 EMF 仍保留在 `resources` 中。若设置了 `imageHandler.convert(image)`，会优先使用自定义结果；未返回结果时再尝试内置 EMF 转换。

浏览器中可以显式接入同时处理普通 WMF 和 EMF 的适配器：

```ts
import { convertToHtml } from '@agilehub/docx-converter';
import { convertMetafileImage } from '@agilehub/docx-converter/browser-metafile';

const result = await convertToHtml(file, {
  imageHandler: { convert: convertMetafileImage },
});
```

WMF、TIFF、SVG 等格式都可以通过 `imageHandler.convert` 接入自定义转换，返回 `{ bytes, mimeType }`，其中 `mimeType` 须为 PNG、JPEG、GIF 或 WebP。

Node 环境中，`emf-converter` 可直接转换不含文字的 EMF；含文字的 EMF 可能需要调用方安装其可选的 `@napi-rs/canvas` 后端或提供字体。核心库不会自动启动进程或上传文档。

### Node 中使用 ImageMagick

安装 ImageMagick 后，可以显式启用本地进程适配器，并指定可信的可执行文件路径：

```ts
import {
  convertToHtmlFile,
  createImageMagickPreviewConverter,
} from '@agilehub/docx-converter/node';

const result = await convertToHtmlFile('demo.docx', {
  imageHandler: {
    convert: createImageMagickPreviewConverter('magick'),
  },
});
```

此适配器只处理标记为公式的 WMF/EMF 预览。命令行示例可设置 `DOCX_MAGICK` 为 `magick` 或其绝对路径后运行：

```sh
node examples/node.mjs demo.docx demo.html
```

## 公式

### OMML 输出格式

默认输出 `<img src="data:image/png;base64,..." data-latex="...">`，可作为独立 HTML 打开，不需要外部字体文件或 MathJax 页面脚本。

```ts
await convertToHtml(file); // 默认 PNG
await convertToHtml(file, { generatedImageOutput: 'svg' }); // 公式和图表使用 SVG
await convertToHtml(file, { formulaOutput: 'mathml' }); // 保留语义 MathML
```

需要无损缩放时可设置 `generatedImageOutput: 'svg'`，此时输出自包含 SVG。公式字形使用 STIX Two Math，与 Word OMML 默认的 Cambria Math 同为衬线数学字体，字形接近但不完全相同；Cambria Math 是专有字体，无法随 MathJax 分发。

MathJax 的动态字体数据（积分号、双线字母、拉伸括号等扩展字形）会随构建产物一起打包，因此包体积比只含基础字形时大约多 1 MB。

公式图片使用公式节点标记：行内公式 class 为 `formula-item formula-image image-inline`，独立行公式 class 为 `formula-item formula-image image-block`；两种公式均使用 `data-type="formula"`。

### MathType / OLE 公式

MathType 公式若附带 WMF/EMF 预览，浏览器演示页会自动转成 PNG。可编辑 OLE 对象中的 `Equation Native` / MTEF 会由核心库解析；转换成功时公式图片包含 `data-latex="..."`。原有 `convertMathTypePreview` 仍可用于只处理公式预览的场景。

LaTeX 是从 OLE/MTEF 重建的，不一定等于作者最初输入的源码。不支持的模板、损坏数据或与预览图明显不符的公式不会写入 `data-latex`，但图片仍会显示。

## 批注

正文中的 Word 批注范围会转换为带属性标记的行内元素。批注正文来自 `word/comments.xml`，选区来自正文中的 `commentRangeStart/commentRangeEnd`。

普通文本批注会尽量合并为一个元素：

```html
<span
  class="annotation-item"
  data-type="annotation"
  data-annotation="中国式现代化的批注"
  style="font-family:&quot;宋体&quot;;font-size:12pt"
>
  中国式现代化
</span>
```

若选区包含公式、图片等自身已有 `data-type` 的内容，会保留原节点并在外层增加批注 `span`，避免属性冲突：

```html
<span class="annotation-item" data-type="annotation" data-annotation="公式批注">
  <span class="formula-item" data-type="formula">...</span>
</span>
```

接入时按以下规则处理：

- `data-type="annotation"` 表示批注包装节点，`data-annotation` 是批注正文。
- 单段文字和文本样式会合并在同一个 `span`，不要假设批注节点一定包含子 `span`。
- 选区跨多个样式或段落时，会按实际文本节点分别输出多个 `annotation-item`。
- 多个批注范围重叠时可能产生嵌套批注节点，应按 DOM 层级保留。
- 仅识别正文中实际包含文字、公式或图片的批注范围。
- 未选中文字、仅在光标位置插入的零长度批注暂不输出。
- 批注作者、时间、已解决状态、回复线程和 Word 侧边栏不属于当前输出范围。

浏览器或编辑器接入时可以按下面的方式查找：

```ts
const annotations = document.querySelectorAll<HTMLElement>(
  '[data-type="annotation"]',
);

for (const element of annotations) {
  console.log(element.dataset.annotation);
}
```

## 脚注

正文中的 `footnoteReference` 会转换为上标节点，编号按首次引用顺序生成，脚注正文来自 `word/footnotes.xml`：

```html
<sup data-type="footnote" data-footnote="脚注的文本">1</sup>
```

脚注转换规则：

- 默认按正文中的首次引用顺序输出 `1、2、3...`。
- `footnotePr/numStart` 可以改变起始编号。
- `footnotePr/numFmt` 为 `decimalEnclosedCircle`、`decimalEnclosedCircleChinese` 或 `ideographEnclosedCircle` 时，1 至 20 输出 `①` 至 `⑳`；超出范围回退为普通数字。
- `data-footnote` 保存脚注正文。多段脚注使用换行符连接。
- 引用存在但找不到脚注正文时，输出 `MISSING_FOOTNOTE` 警告，仍保留可显示的编号。
- 只输出正文引用和脚注正文，不生成 Word 页面底部的脚注分隔线或脚注区域。
- 尾注、自定义复杂脚注标记和 Word 分页位置不在当前支持范围内。

前端接入时可读取上标节点的编号和完整正文：

```ts
const footnotes = document.querySelectorAll<HTMLElement>(
  'sup[data-type="footnote"]',
);

for (const element of footnotes) {
  console.log({
    number: element.textContent,
    content: element.dataset.footnote,
  });
}
```

需要把这些节点映射到编辑器时，见 Tiptap 接入指南的 [批注映射](json-tiptap-integration.md#6-批注映射) 和 [脚注映射](json-tiptap-integration.md#7-脚注映射)。

## 原生图表、组合图形与 SmartArt

- **原生图表**：支持从 OOXML 图表缓存读取标准折线图和纵向簇状柱形图并生成图片，保留分类、数值坐标轴和缓存数据；HTML 和 JSON 均可使用。`generatedImageOutput` 默认为 `'png'`，可设为 `'svg'`。不重新计算嵌入工作簿；堆积图、百分比堆积图、横向条形图及复杂组合图尚未完整支持。
- **Word 组合图形**：支持 DrawingML 嵌套组合中的矩形、圆角矩形、椭圆、直线、向下箭头及三角连接箭头，并把文本框文字与图形一起生成图片。`drawingOutput` 默认继承 `generatedImageOutput`（即 PNG），可单独设为 `'svg'`。
- **SmartArt**：读取 Word 缓存的 `diagrams/drawing1.xml` 最终形状、旋转、文本和配色信息并生成图片，不尝试重新执行 SmartArt 布局引擎。

```ts
await convertToHtml(file);
await convertToHtml(file, { generatedImageOutput: 'svg' });
await convertToHtml(file, { drawingOutput: 'svg' });
await convertToJson(file, { drawingOutput: 'png' });
```

组合图形的 PNG 使用白色背景，默认按显示尺寸的 3 倍分辨率生成，超大图按最长边 8192 像素、约 1600 万像素的上限等比例降低倍率。栅格化失败时返回 `DRAWING_PNG_FAILED` 警告，不会静默改为 SVG。
