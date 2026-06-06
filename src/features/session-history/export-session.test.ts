import { describe, expect, it } from 'vitest'
import type { TranslationHistorySession } from './types'
import { buildMarkdownExport, createMarkdownFileName } from './export-session'

describe('export-session', () => {
  it('生成包含标题、时间、字幕数量、摘要和双语字幕的 Markdown', () => {
    const markdown = buildMarkdownExport(makeSession())

    expect(markdown).toContain('# React Conf Keynote')
    expect(markdown).toContain('- 创建时间：2026-06-06 18:42')
    expect(markdown).toContain('- 更新时间：2026-06-06 19:15')
    expect(markdown).toContain('- 字幕数量：2')
    expect(markdown).toContain('## 摘要')
    expect(markdown).toContain('关于并发渲染与用户体验的讨论。')
    expect(markdown).toContain('### 00:12 - 00:18')
    expect(markdown).toContain('原文：Today we discuss responsive interfaces.')
    expect(markdown).toContain('译文：今天我们讨论响应式界面。')
  })

  it('生成安全的 Markdown 文件名', () => {
    expect(
      createMarkdownFileName(makeSession({ title: 'React:/课程*记录?' })),
    ).toBe('莫莫翻译记录-React课程记录-202606061842.md')
  })
})

function makeSession(
  overrides: Partial<TranslationHistorySession> = {},
): TranslationHistorySession {
  return {
    id: 'session-1',
    title: 'React Conf Keynote',
    createdAt: new Date('2026-06-06T18:42:00+08:00').getTime(),
    updatedAt: new Date('2026-06-06T19:15:00+08:00').getTime(),
    summary: '关于并发渲染与用户体验的讨论。',
    sentences: [
      {
        id: '1',
        sourceText: 'Today we discuss responsive interfaces.',
        targetText: '今天我们讨论响应式界面。',
        startTime: 12,
        endTime: 18,
        isFinal: true,
      },
      {
        id: '2',
        sourceText: 'Rendering affects trust.',
        targetText: '渲染会影响信任感。',
        startTime: 19,
        endTime: 27,
        isFinal: true,
      },
    ],
    ...overrides,
  }
}
