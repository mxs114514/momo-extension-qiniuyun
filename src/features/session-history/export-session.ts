import type { TranslationHistorySession } from './types'

export function buildMarkdownExport(
  session: TranslationHistorySession,
): string {
  return [
    `# ${session.title}`,
    '',
    `- 创建时间：${formatDateTime(session.createdAt)}`,
    `- 更新时间：${formatDateTime(session.updatedAt)}`,
    `- 字幕数量：${session.sentences.length}`,
    '',
    '## 摘要',
    '',
    session.summary || '暂无摘要',
    '',
    '## 翻译内容',
    '',
    ...session.sentences.flatMap((sentence) => [
      `### ${formatTime(sentence.startTime)} - ${formatTime(sentence.endTime)}`,
      '',
      `原文：${sentence.sourceText || '无'}`,
      '',
      `译文：${sentence.targetText || '无'}`,
      '',
    ]),
  ].join('\n')
}

export function createMarkdownFileName(
  session: TranslationHistorySession,
): string {
  const safeTitle = session.title.replace(/[\\/:*?"<>|]/g, '').trim()
  return `莫莫翻译记录-${safeTitle || '未命名'}-${formatCompactDateTime(
    session.createdAt,
  )}.md`
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatCompactDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}${pad(date.getHours())}${pad(date.getMinutes())}`
}

function formatTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const restSeconds = totalSeconds % 60
  return `${pad(minutes)}:${pad(restSeconds)}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
