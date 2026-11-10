# 错误、进度、限制与兼容性

本文说明转换失败与警告的处理方式、进度和取消、资源限制、支持范围及常见问题。基础调用和参数见 [README](../README.md)。

## 错误、进度与取消

`convertToHtml` 和 `convertToJson` 都返回 Promise：

- **文件结构错误、超出资源限制、图片回调抛错**等会使 Promise 拒绝；
- **内容兼容问题**通常进入 `warnings`，不会伪装成完整支持；
- `DocxError` 提供 `code` 和 `message`，可用于分支处理。

```ts
import { DocxError } from '@agilehub/docx-converter';

try {
  const result = await convertToHtml(file);
  for (const warning of result.warnings) {
    console.warn(warning.code, warning.message);
  }
} catch (error) {
  if (error instanceof DocxError) {
    console.error(error.code, error.message);
  } else {
    throw error;
  }
}
```

### 进度

```ts
const result = await convertToHtml(file, {
  onProgress(event) {
    console.log(event.stage, event.completed, event.total);
  },
});
```

进度阶段依次为：

```text
reading → extracting → parsing → rendering → complete
```

只有成功后才发送 `complete`。解析阶段的 `total` 表示顶层段落/表格数量，不代表图片上传或整项任务的百分比。

### 取消

```ts
const controller = new AbortController();

const result = await convertToHtml(file, {
  signal: controller.signal,
});

// 在别处请求取消
controller.abort();
```

同步 ZIP/XML 计算无法被同一线程中尚未执行的事件中断。需要强制终止时，应像演示页一样把转换放进 Web Worker 并 `terminate()`。

## 资源限制与安全

默认限制：

| 参数 | 默认值 |
| --- | --- |
| 输入文件 | 50 MiB |
| 解压总量 | 150 MiB |
| 单条目 | 40 MiB |
| ZIP 条目数 | 10000 |
| XML 深度 | 128 |

可通过 `limits` 调整。XML 拒绝 DTD/实体；输出只由受控标签构建，链接协议和图片格式会校验。

生产环境处理不可信大文件时，仍建议使用独立 Worker / 进程并设置内存和时间限制。

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
| 批注 | 正文批注范围输出 `annotation-item`、`data-type="annotation"` 和 `data-annotation` | 批注作者、时间、回复线程和侧边栏视图不输出 |

其他限制：

- 只转换**正文**；页眉、页脚、脚注、尾注部件会提示未包含；正文批注只保留范围和批注正文；
- 不支持旧版 `.doc`、加密文件和 Strict OOXML；Strict 文档可先用 Word 另存为普通 DOCX；
- 网络图片的加载取决于 CORS、协议和页面安全策略；
- 公式 LaTeX 是结构重建结果，不保证与作者输入完全一致。

更细的模块边界和设计取舍见 [模块架构](architecture.md)。

## 常见问题

**安装 `@agilehub/docx-converter` 失败？**

请确认包名拼写正确，并执行 `npm install @agilehub/docx-converter`。如果所用镜像源尚未同步最新版本，可改用官方源安装：

```sh
npm install @agilehub/docx-converter --registry=https://registry.npmjs.org
```

本地试用未发布改动时，可在仓库执行 `npm pack`，再安装生成的 `.tgz` 文件。

**导出的 HTML 中中文或公式与 Word 不完全一致？**

库不嵌入字体文件，显示效果取决于运行环境中已安装的字体。公式默认使用 STIX Two Math，字形接近 Word 的 Cambria Math，但不完全相同。

**页眉、页脚、脚注没有出现在结果中？**

当前只转换正文；页眉、页脚、脚注、尾注会给出未包含的提示。正文批注会输出选区标记和批注正文，但不会生成 Word 风格的侧边栏或回复线程。

**网络地址转换失败？**

只接受 HTTP(S) 地址；浏览器还要求目标服务器允许 CORS，HTTPS 页面不能加载 HTTP 资源。下载失败会抛出 `FETCH_FAILED`。
