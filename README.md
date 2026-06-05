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

当前项目已接入 Playwright E2E 测试。`pnpm check` 会自动执行 `pnpm test:e2e`，测试配置会按需启动本地开发服务器。

如果首次运行 E2E 时提示缺少浏览器，请执行：

```bash
pnpm dlx playwright install chromium
```
