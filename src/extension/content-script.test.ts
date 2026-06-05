import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type MessageListener = (message: unknown) => void

const listeners: MessageListener[] = []

beforeEach(() => {
  listeners.length = 0
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (listener: MessageListener) => {
          listeners.push(listener)
        },
      },
    },
  })
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('content script overlay', () => {
  it('展示 speech/snapshot 中最新的中文字幕', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    listeners.at(-1)?.({
      type: 'speech/snapshot',
      snapshot: {
        status: 'translating',
        error: null,
        sentences: [
          {
            id: '1',
            sourceText: 'hello',
            targetText: '你好',
            startTime: 0,
            endTime: 1,
            isFinal: true,
          },
          {
            id: '2',
            sourceText: 'world',
            targetText: '世界',
            startTime: 1,
            endTime: 2,
            isFinal: false,
          },
        ],
      },
    })

    expect(screenText()).toBe('世界')
  })

  it('stop、idle 或 error 状态会移除字幕容器', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    listeners.at(-1)?.({
      type: 'speech/snapshot',
      snapshot: {
        status: 'translating',
        error: null,
        sentences: [
          {
            id: '1',
            sourceText: 'hello',
            targetText: '你好',
            startTime: 0,
            endTime: 1,
            isFinal: false,
          },
        ],
      },
    })

    expect(screenText()).toBe('你好')

    for (const status of ['idle', 'stopping', 'error']) {
      initializeContentScriptOverlay()
      listeners.at(-1)?.({
        type: 'speech/snapshot',
        snapshot: {
          status,
          error: status === 'error' ? '网络异常' : null,
          sentences: [],
        },
      })

      expect(document.querySelector('[data-momo-caption-overlay]')).toBeNull()
    }
  })

  it('多次初始化不会重复注入容器或注册监听器', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    initializeContentScriptOverlay()

    listeners.at(-1)?.({
      type: 'speech/snapshot',
      snapshot: {
        status: 'translating',
        error: null,
        sentences: [
          {
            id: '1',
            sourceText: 'hello',
            targetText: '你好',
            startTime: 0,
            endTime: 1,
            isFinal: false,
          },
        ],
      },
    })

    expect(listeners).toHaveLength(1)
    expect(
      document.querySelectorAll('[data-momo-caption-overlay]'),
    ).toHaveLength(1)
  })
})

function screenText(): string {
  return (
    document.querySelector('[data-momo-caption-overlay]')?.textContent ?? ''
  )
}
