# 本地开发、构建与测试

本文面向仓库开发者和需要本地运行演示的使用者。公共 API 用法见 [README](../README.md)。

## 运行演示

环境要求：Node.js **22.12+**（推荐 Node 24）和 npm。

```sh
npm ci
npm run dev
```

打开终端提示的地址（默认 `http://127.0.0.1:5173`），选择或拖入一个 `.docx` 文件，或点击“试用示例文档”。

演示页支持预览、查看 HTML 源码、复制内容、下载 HTML / JSON 和资源 ZIP，并支持取消与 60 秒超时终止。

预览构建后的生产版本：

```sh
npm run build
npm run preview
```

`npm run preview` 会启动 `dist-demo` 中的完整浏览器应用。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地演示（默认 5173）。 |
| `npm run check` | 架构检查、4 个 TypeScript 配置类型检查和 Vitest。 |
| `npm run build` | 构建 ESM/CJS/UMD、类型声明和演示应用。 |
| `npm run preview` | 预览构建后的演示应用（默认 4173）。 |
| `npm run test:e2e` | 针对构建后演示运行 Playwright 验收。 |
| `npm run verify` | `check + build + test:e2e`，CI 入口。 |
| `npm pack` | 构建并生成可安装的 tarball。 |

## 构建产物

| 位置 | 用途 |
| --- | --- |
| `dist/index.js` / `index.cjs` | npm ESM / CommonJS 主入口 |
| `dist/node.js` / `node.cjs` | Node 文件路径入口 |
| `dist/browser-metafile.js` / `browser-metafile.cjs` | 浏览器 MathType 预览图转换适配器 |
| `dist/docx-converter.browser.js` | 浏览器 ESM 构建 |
| `dist/docx-converter.umd.cjs` | 内含依赖的 UMD 构建，暴露 `window.DocxConverter` |
| `dist/*.d.ts` | TypeScript 类型声明 |
| `dist-demo/` | 可部署到静态服务器的完整浏览器应用 |

`dist-demo` 使用相对资源路径，可部署在子路径。Worker 应通过 HTTP(S) 加载，不能直接双击入口文件运行。普通 script 示例位于 `examples/browser.html`，直接调用库、不使用 Worker，适合小文件演示。

## 全新检出后的首次构建

若仓库中没有 `dist/`，`npm run build` 可能在类型检查阶段找不到 `dist/node.js`。先生成库产物和类型声明，再执行完整构建：

```sh
npx vite build --config vite.lib.config.ts
npx tsc -p tsconfig.build.json
npm run build
```

## 测试

浏览器验收前需先构建演示，并执行：

```sh
npx playwright install chromium
```

也可以把 `DOCX_TEST_BROWSER` 设置为本地 Chrome / Edge 的绝对路径。

测试组织：

- `tests/fixtures/`：最小 DOCX、EMF、WMF、OLE/MTEF 构造器，以及 300 多个大学公式的 OMML 语料；
- `tests/unit/`：端口、模块边界和 Worker 生命周期；
- `tests/integration/`：公开转换行为、公式、表格、图片和失败边界；
- `tests/e2e/`：浏览器预览、下载、URL 输入和公式语料。

`public/sample.docx` 是人工构造的可分发示例；可执行 `node scripts/generate-sample.ts` 在 Node 24 下重新生成。

Windows 沙箱若限制默认临时目录，可把 `TEMP` / `TMP` 指向项目下的 `.tmp` 后运行测试。

修改约定、模块归属和交付流程见 [贡献指南](../CONTRIBUTING.md)，模块设计见 [架构文档](architecture.md)。
