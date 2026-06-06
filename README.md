# 莫莫实时字幕

莫莫实时字幕是一个用于个人比赛演示的 AI 同声传译浏览器扩展。它可以捕获当前浏览器标签页的英文音频，实时生成中文字幕，并把本次翻译保存为可回顾、可重命名、可导出的学习记录。

项目同时保留了一个网页调试入口：网页 Demo 使用麦克风作为音频来源，便于开发时快速验证 UI、状态机和实时翻译链路；浏览器扩展版使用当前活动标签页音频作为声音来源。

## 功能概览

- 实时英译中字幕：采集音频后通过腾讯云实时语音翻译生成中文字幕。
- 标签页音频捕获：扩展版通过 `chrome.tabCapture` 捕获当前活动标签页声音。
- 页面悬浮字幕面板：在网页中显示字幕、状态和开始/暂停/继续/停止控制。
- Side Panel 历史记录：查看历史会话、进入详情、重命名、删除和导出记录。
- Markdown 导出：将翻译记录导出为包含摘要、原文和译文的 Markdown 文件。
- AI 摘要：配置 DeepSeek API Key 后自动生成中文摘要；失败或未配置时回退到本地摘要。
- 字幕皮肤：内置 `流萤` 系列 WebP 皮肤资源，用于页面字幕面板展示。

## 环境要求

- Windows 11 / PowerShell
- Node.js
- pnpm
- Chrome 或 Edge

首次拉取项目后安装依赖：

```bash
pnpm install
pnpm prepare
```

## 环境变量

复制 `.env.example` 为 `.env.local`，并填入本地演示用凭证：

```bash
VITE_TENCENT_APP_ID=
VITE_TENCENT_SECRET_ID=
VITE_TENCENT_SECRET_KEY=
VITE_DEEPSEEK_API_KEY=
VITE_DEEPSEEK_MODEL=deepseek-v4-flash
```

说明：

- `VITE_TENCENT_APP_ID`、`VITE_TENCENT_SECRET_ID`、`VITE_TENCENT_SECRET_KEY` 用于腾讯云实时语音翻译。
- `VITE_DEEPSEEK_API_KEY` 用于历史记录摘要生成，可不填；不填时使用本地摘要。
- `VITE_DEEPSEEK_MODEL` 默认是 `deepseek-v4-flash`。
- 真实密钥只允许放在 `.env.local`，不要提交到 Git。

## 本地网页调试

启动开发服务：

```bash
pnpm dev
```

网页 Demo 的音频来源是麦克风，适合调试实时翻译面板、按钮状态、错误提示和字幕展示。

## 浏览器扩展使用说明

构建扩展：

```bash
pnpm build:extension
```

构建完成后会生成 `dist/` 目录。

在 Chrome 中加载：

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择项目中的 `dist` 目录

在 Edge 中加载：

1. 打开 `edge://extensions`
2. 开启“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择项目中的 `dist` 目录

使用流程：

1. 打开一个正在播放英文音频或视频的普通网页标签页。
2. 点击浏览器工具栏里的“莫莫实时字幕”图标，激活当前页面。
3. 在页面字幕面板中点击“开始翻译”。
4. 浏览器弹出标签页音频捕获授权时，选择当前标签页并允许捕获。
5. 字幕会显示在页面悬浮字幕面板中，可以暂停、继续或停止翻译。
6. 点击页面中的“历史记录”入口或打开 Side Panel，可以查看已保存的翻译记录。
7. 在历史详情中可以重命名、删除记录，也可以导出 Markdown。

注意：

- 扩展翻译的是点击插件并开始翻译时所在窗口的当前活动标签页。
- 浏览器内置页面、扩展商店页面等受限页面通常不能捕获声音。
- 修改扩展代码后需要重新执行 `pnpm build:extension`，再到扩展管理页刷新插件。

## 用到的工具、库和模型

核心技术：

- React 19 / React DOM 19：构建实时字幕面板和历史记录界面。
- TypeScript 6：提供类型约束和模块边界。
- Vite 8：构建网页入口、Side Panel、Offscreen Document、Background 和 Content Script。
- Tailwind CSS 4：负责页面样式和组件布局。
- Manifest V3：浏览器扩展运行规范。

浏览器与音频能力：

- Chrome Extension APIs：`activeTab`、`tabCapture`、`offscreen`、`sidePanel`、`storage`、`tabs`。
- Web Audio API / AudioWorklet：音频处理、降采样和 PCM 分包。
- WebSocket：连接腾讯云实时语音翻译服务。
- Web Crypto API：生成腾讯云接口签名。

数据与导出：

- Dexie / IndexedDB：保存历史翻译会话。
- Blob API：导出 Markdown 文件。

AI 服务与模型：

- 腾讯云实时语音翻译：用于英文语音到中文字幕的实时翻译。
- 腾讯云翻译模型：`hunyuan-translation-lite`。
- DeepSeek Chat Completions API：用于历史记录摘要生成。
- DeepSeek 默认摘要模型：`deepseek-v4-flash`。

工程质量：

- Vitest：单元测试。
- Testing Library：React 组件测试。
- Playwright：网页和扩展端到端测试。
- ESLint / Stylelint / Prettier：代码、样式和格式检查。
- Husky / lint-staged：提交前检查。
- Commitlint / Commitizen / cz-git：规范化提交信息。

## 常用命令

```bash
pnpm dev
pnpm build
pnpm build:extension
pnpm check:extension
pnpm test
pnpm test:e2e
pnpm test:e2e:extension
pnpm fix
pnpm check
```

命令说明：

- `pnpm dev`：启动网页调试入口。
- `pnpm build`：执行类型检查并构建项目。
- `pnpm build:extension`：构建浏览器扩展产物。
- `pnpm check:extension`：构建并校验扩展产物。
- `pnpm test`：运行单元和组件测试。
- `pnpm test:e2e`：运行网页端到端测试。
- `pnpm test:e2e:extension`：运行扩展端到端测试。
- `pnpm fix`：自动修复 lint、stylelint 和格式问题。
- `pnpm check`：执行类型检查、lint、格式检查、单元测试和网页 E2E。

如果首次运行 Playwright 时提示缺少浏览器，请执行：

```bash
pnpm dlx playwright install chromium
```

## 调试控制台

- Background Service Worker：在 `chrome://extensions` 找到插件，进入“详细信息”，点击 Service worker 的“检查视图”。
- 页面悬浮字幕面板：在被翻译的网页中按 `F12`，查看页面 DevTools。
- Offscreen Document：如果扩展详情页出现 offscreen 检查入口，可以从那里打开；否则优先查看 Service Worker 和页面控制台。

## 提交流程

提交前建议执行：

```bash
pnpm fix
pnpm check
git status
git add .
pnpm cz
```

## 演示地址

b站演示地址：<https://www.bilibili.com/video/BV1F6En6GE33/?spm_id_from=333.1387.homepage.video_card.click&vd_source=ceb9de55df61050025295415cd180e63>
