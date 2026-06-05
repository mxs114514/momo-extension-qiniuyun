<!-- BEGIN:nextjs-agent-rules -->
# 这不是你熟悉的 Next.js

此版本包含破坏性变更：API、约定和文件结构都可能与你训练数据中的 Next.js 不同。编写任何代码前，必须先阅读 `node_modules/next/dist/docs/` 中的相关指南。`doc/history`是已经弃置的历史文件，除非用户主动要求翻阅，不然默认忽视这些文件。务必遵守弃用提示。
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-agent-rules -->
# 项目协作规则

## 环境

- 电脑环境是 Windows 11。
- 命令行默认使用 PowerShell。
- 执行命令时注意默认使用 UTF-8 显示输出，例如先设置 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`，避免再次出现 PowerShell 输出编码导致的乱码或超时问题。

## 语言

- 与用户对话默认使用中文。
- 代码中涉及输出、打印、日志、提示文案和注释等内容时，默认使用中文。

## 技术栈和包管理

- 项目技术栈在`doc\技术实施指南.md`
- 默认包管理工具是 pnpm。

## 工作规范

- 采用TDD模式开发
- 改代码后应执行测试,避免修改意外区域
- 改完代码后不允许私自提交到远程仓库,并且应该总结本次改动让用户了解
<!-- END:project-agent-rules -->
