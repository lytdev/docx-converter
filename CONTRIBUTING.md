# 开发与模块维护

本项目同时交付 npm 库和浏览器示例，使用一个 package.json 和锁文件管理依赖。阅读 [架构说明](docs/architecture.md) 后再新增跨模块依赖。

## 功能改在哪里

| 变更 | 主要位置 | 验证重点 |
| --- | --- | --- |
| 对外选项 / 返回字段 | src/contracts/conversion.ts、src/index.ts | 类型兼容、默认值、README 使用示例 |
| 转换阶段 / 资源限制 | src/application | 错误码、取消、阶段事件、限制生效 |
| ZIP / 包关系 / XML | src/infrastructure | 越界关系、损坏输入、解压限制、XML 约束 |
| 段落 / 表格 / 绘图 | src/modules/document | 最小 OOXML fixture 和最终 HTML 结构 |
| 字体 / 样式 / 编号 | src/modules/styles、numbering | 继承优先级、明确 false、续号及嵌套 |
| OMML 公式 | src/modules/math | MathML、LaTeX、未知结构降级诊断 |
| 图片格式 / 地址 | src/modules/images | 字节识别、异步策略、取消、URL 校验 |
| HTML / CSS / 图表注 | src/rendering/html | 手写模型单测及转换集成测试 |
| Node 文件入口 | src/adapters/node | 文件大小预检查及公共 API 行为 |
| 页面交互 / Worker | apps/playground | 任务替换、取消、错误展示、导出与浏览器回归 |

不要直接给模块增加文件系统、DOM 或网络副作用；先确认是否属于 Node 适配器、应用 UI 或显式图片回调。渲染层新增所需数据时，应由解析层写入模型或通过最小端口提供，不能反向读取解析器。

## 日常检查

```sh
npm ci
npm run dev
npm run check                 # 架构 + 库/页面/Worker/工具类型 + Vitest
npm run build                 # ESM/CJS/UMD、声明文件、演示应用
npm run test:e2e              # 对构建产物执行浏览器验证
npm run verify               # 合并以上检查，适合作为 CI 入口
npm pack                     # 自动构建后生成本地可安装 tarball
```

首次运行浏览器测试前执行 `npx playwright install chromium`，或把 `DOCX_TEST_BROWSER` 设置为本地 Chrome/Edge 可执行文件绝对路径。测试服务器监听 4173；开发服务器默认 5173。CI 环境会启动新的测试服务器，不复用已有进程。

Windows 受限环境可以在项目内创建 `.tmp` 并设置 `TEMP`、`TMP` 后运行 Vitest。测试截图、下载文件、依赖、构建产物和 tarball 已加入 .gitignore。不要把 Java 参考项目中的实际文档提交为公共样例。

## 修改与交付约定

1. 明确功能所属模块；跨层变更先更新架构约束和文档，不能仅为消除检查错误放开规则。
2. 用 `tests/fixtures/docx.ts` 构造可分发的最小复现；转换能力放 integration，端口/生命周期放 unit，浏览器交互放 e2e。测试面向行为和故障边界，不绑定私有方法。
3. 新增能力同时覆盖正常路径、缺失或不支持内容的诊断；修改异步逻辑时覆盖取消或旧结果覆盖。
4. 公共 API 的兼容性以 `src/index.ts`、`src/node.ts` 为准。内部路径不承诺兼容，不增加面向消费者的深层导出。
5. 提交前运行 `npm run verify`；涉及包入口时额外在独立目录安装 tarball，检查 ESM、CommonJS 和 NodeNext 类型解析。预打包检查不替代完整验收。
6. 更新 README 的支持范围与示例。版本按公共 API 的影响决定；只有获得明确发布授权后再执行 npm publish。

当前仓库不绑定远程 CI 平台；接入 CI 时使用 Node 24、`npm ci`、安装 Playwright 浏览器后运行 `npm run verify` 即可复用本地检查。
