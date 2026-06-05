# momo

这是一个基于 react、Tailwind CSS 和 shadcn/ui 的项目。

## 技术栈与第三方库

- React 19 / React DOM 19：页面和组件渲染。
- Tailwind CSS 4：样式系统，配合 `@tailwindcss/postcss` 使用。
- TypeScript 5：类型检查与项目类型约束。
- Playwright：端到端测试，包含 `@playwright/test` 和 `@playwright/cli`。
- ESLint / Stylelint / Prettier：代码、样式和格式检查。
- Husky / lint-staged：Git hooks 与提交前检查。
- Commitlint / Commitizen / cz-git：规范化提交信息。

## 完整开发到提交流程

首次拉取项目后安装依赖并初始化 Husky：

```bash
pnpm install
pnpm prepare
```

日常开发：

```bash
pnpm dev
```

`pnpm dev` 启动的是网页 Demo，声音来源是麦克风，用于快速调试 UI 和核心翻译链路。

## 浏览器插件使用说明

插件版声音来源是当前活动浏览器标签页，不是麦克风。多个浏览器窗口同时播放视频时，插件会翻译你点击插件并点击“开始翻译”时所在窗口的当前活动标签页。

构建插件：

```bash
pnpm build:extension
```

构建完成后会生成 `dist/` 目录。

在 Chrome 中加载：

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择项目里的 `dist` 目录

在 Edge 中加载：

1. 打开 `edge://extensions`
2. 开启“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择项目里的 `dist` 目录

测试插件：

1. 打开一个正在播放英文音频或视频的标签页。
2. 点击浏览器右上角“莫莫实时字幕”插件图标。
3. 点击“开始翻译”。
4. 字幕会显示在插件 Popup / Side Panel 中，并在页面底部显示字幕覆盖层。

修改插件代码后，需要重新构建并刷新插件：

```bash
pnpm build:extension
```

然后回到 `chrome://extensions` 或 `edge://extensions`，点击插件卡片上的刷新按钮。

常用插件检查命令：

```bash
pnpm check:extension
pnpm test:e2e:extension
```

## 插件控制台查看

- Background Service Worker：在 `chrome://extensions` 找到插件，进入“详细信息”，点击 Service worker 的“检查视图”。
- Popup：点击插件图标打开 Popup 后，在 Popup 上右键选择“检查”。
- 页面字幕覆盖层：在被翻译的网页中按 `F12`，查看页面 DevTools。
- Offscreen Document：如果扩展详情页出现 offscreen 相关检查入口，可从那里打开；否则优先查看 Service Worker 和页面控制台。

代码完成后先自动修复和格式化：

```bash
pnpm fix
```

提交前执行完整检查：

```bash
pnpm check
```

确认 Git 状态并提交：

```bash
git status
git add .
pnpm cz
```

## 质量检查说明

当前项目已接入 Playwright E2E 测试。`pnpm test:e2e` 会先构建产物，再用临时静态服务器测试网页入口；插件 E2E 使用独立命令 `pnpm test:e2e:extension`。

如果首次运行 E2E 时提示缺少浏览器，请执行：

```bash
pnpm dlx playwright install chromium
```
