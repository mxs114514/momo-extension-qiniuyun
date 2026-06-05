import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SpeechTranslationController } from './speech-translation-controller'
import { SpeechTranslationPanel } from './SpeechTranslationPanel'

function controller(status: 'idle' | 'translating' | 'paused' | 'error') {
  const snapshot = {
    status,
    sentences:
      status === 'translating'
        ? [
            {
              id: '1',
              sourceText: 'Welcome everyone',
              targetText: '欢迎大家',
              startTime: 0,
              endTime: 100,
              isFinal: false,
            },
          ]
        : [],
    error: status === 'error' ? '连接失败' : null,
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  } as unknown as SpeechTranslationController
}

describe('SpeechTranslationPanel', () => {
  it('初始状态显示开始翻译和比赛演示说明', () => {
    render(<SpeechTranslationPanel controller={controller('idle')} />)
    expect(screen.getByRole('button', { name: '开始翻译' })).toBeVisible()
    expect(screen.getByText(/个人比赛演示/)).toBeVisible()
  })

  it('翻译中只显示中文并提供暂停和停止', () => {
    render(<SpeechTranslationPanel controller={controller('translating')} />)
    expect(screen.getByText('欢迎大家')).toBeVisible()
    expect(screen.queryByText('Welcome everyone')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '暂停' })).toBeVisible()
    expect(screen.getByRole('button', { name: '停止' })).toBeVisible()
  })

  it('调用开始、暂停、继续和停止', () => {
    const idle = controller('idle')
    const { unmount } = render(<SpeechTranslationPanel controller={idle} />)
    fireEvent.click(screen.getByRole('button', { name: '开始翻译' }))
    expect(idle.start).toHaveBeenCalled()
    unmount()

    const translating = controller('translating')
    render(<SpeechTranslationPanel controller={translating} />)
    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    expect(translating.pause).toHaveBeenCalled()
    expect(translating.stop).toHaveBeenCalled()
  })

  it('调用 controller 方法时保留实例 this', () => {
    const rawController = {
      snapshot: {
        status: 'idle',
        sentences: [],
        error: null,
      },
      started: false,
      getSnapshot: () => rawController.snapshot,
      subscribe() {
        return () => undefined
      },
      start() {
        this.started = true
      },
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
    }
    const boundController =
      rawController as unknown as SpeechTranslationController

    render(<SpeechTranslationPanel controller={boundController} />)
    fireEvent.click(screen.getByRole('button', { name: '开始翻译' }))

    expect(rawController.started).toBe(true)
  })

  it('暂停时允许继续，错误时显示提示并允许重试', () => {
    const paused = controller('paused')
    const { unmount } = render(<SpeechTranslationPanel controller={paused} />)
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(paused.resume).toHaveBeenCalled()
    unmount()

    render(<SpeechTranslationPanel controller={controller('error')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('连接失败')
    expect(screen.getByRole('button', { name: '重新开始' })).toBeVisible()
  })
})
