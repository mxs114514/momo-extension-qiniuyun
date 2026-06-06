import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  TranslationHistorySession,
  TranslationHistorySummary,
} from './types'
import { SessionHistoryPanelView } from './SessionHistoryPanel'

describe('SessionHistoryPanelView', () => {
  it('默认展示历史记录列表且不渲染实时翻译控制', async () => {
    const selectSession = vi.fn()
    render(
      <SessionHistoryPanelView
        model={{
          sessions: [makeSummary()],
          selectedSession: null,
          selectSession,
          backToList: vi.fn(),
          renameSession: vi.fn(),
          deleteSession: vi.fn(),
          exportSession: vi.fn(),
          error: null,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: '学习记录' }),
    ).toBeInTheDocument()
    expect(screen.getByText('React Conf Keynote')).toBeInTheDocument()
    expect(screen.queryByText('开始翻译')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /React Conf/ }))
    expect(selectSession).toHaveBeenCalledWith('s1')
  })

  it('在列表和详情页显示 AI 摘要失败提示', () => {
    const warning = 'AI 摘要失败，已使用本地摘要：DeepSeek 请求失败'
    const { rerender } = render(
      <SessionHistoryPanelView
        model={{
          sessions: [makeSummary({ summaryWarning: warning })],
          selectedSession: null,
          selectSession: vi.fn(),
          backToList: vi.fn(),
          renameSession: vi.fn(),
          deleteSession: vi.fn(),
          exportSession: vi.fn(),
          error: null,
        }}
      />,
    )

    expect(screen.getByText(warning)).toBeInTheDocument()

    rerender(
      <SessionHistoryPanelView
        model={{
          sessions: [makeSummary({ summaryWarning: warning })],
          selectedSession: makeSession({ summaryWarning: warning }),
          selectSession: vi.fn(),
          backToList: vi.fn(),
          renameSession: vi.fn(),
          deleteSession: vi.fn(),
          exportSession: vi.fn(),
          error: null,
        }}
      />,
    )

    expect(screen.getByText(warning)).toBeInTheDocument()
  })

  it('详情页支持改名、删除和导出 Markdown', async () => {
    const renameSession = vi.fn()
    const deleteSession = vi.fn()
    const exportSession = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <SessionHistoryPanelView
        model={{
          sessions: [makeSummary()],
          selectedSession: makeSession(),
          selectSession: vi.fn(),
          backToList: vi.fn(),
          renameSession,
          deleteSession,
          exportSession,
          error: null,
        }}
      />,
    )

    await userEvent.clear(screen.getByLabelText('记录名称'))
    await userEvent.type(screen.getByLabelText('记录名称'), 'React 课程记录')
    await userEvent.click(screen.getByRole('button', { name: '保存名称' }))
    await userEvent.click(screen.getByRole('button', { name: '导出 Markdown' }))
    await userEvent.click(screen.getByRole('button', { name: '删除记录' }))

    expect(renameSession).toHaveBeenCalledWith('s1', 'React 课程记录')
    expect(exportSession).toHaveBeenCalledWith('s1')
    expect(deleteSession).toHaveBeenCalledWith('s1')
  })
})

function makeSummary(
  overrides: Partial<TranslationHistorySummary> = {},
): TranslationHistorySummary {
  return {
    id: 's1',
    title: 'React Conf Keynote',
    createdAt: new Date('2026-06-06T18:42:00+08:00').getTime(),
    updatedAt: new Date('2026-06-06T19:15:00+08:00').getTime(),
    summary: '关于并发渲染与用户体验的讨论。',
    sentenceCount: 2,
    ...overrides,
  }
}

function makeSession(
  overrides: Partial<TranslationHistorySession> = {},
): TranslationHistorySession {
  return {
    ...makeSummary(overrides),
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
