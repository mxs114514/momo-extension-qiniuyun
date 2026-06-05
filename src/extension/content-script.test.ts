import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type MessageListener = (message: unknown) => void

const listeners: MessageListener[] = []
const sendMessage = vi.fn()

beforeEach(() => {
  listeners.length = 0
  sendMessage.mockReset()
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
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
  it('初始化后展示页面悬浮球入口', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()

    expect(document.querySelector('[data-momo-caption-bubble]')).not.toBeNull()
    expect(document.querySelector('[data-momo-caption-overlay]')).toBeNull()
  })

  it('点击悬浮球后在固定尺寸面板中最多展示最新两句中文字幕', async () => {
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
            isFinal: true,
          },
          {
            id: '3',
            sourceText: 'again',
            targetText: '再见',
            startTime: 2,
            endTime: 3,
            isFinal: false,
          },
        ],
      },
    })
    clickBubble()

    expect(screenText()).toBe('世界\n再见')
    expect(panelStyle().position).toBe('fixed')
    expect(panelStyle().width).toBe('1620px')
    expect(panelStyle().height).toBe('200px')
  })

  it('点击字幕面板右上角减号后收回为悬浮球并保留字幕', async () => {
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
    clickBubble()

    expect(screenText()).toBe('你好')

    closePanel()

    expect(document.querySelector('[data-momo-caption-bubble]')).not.toBeNull()
    expect(document.querySelector('[data-momo-caption-overlay]')).toBeNull()

    clickBubble()

    expect(screenText()).toBe('你好')
  })

  it('展开和收起字幕面板不会发送翻译控制消息', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    clickBubble()
    closePanel()

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('拖动悬浮球后松手会吸附到更近的页面边缘', async () => {
    setViewport(1000, 800)
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    drag('[data-momo-caption-bubble]', [
      [952, 752],
      [760, 360],
    ])

    const bubble = getElement('[data-momo-caption-bubble]')
    expect(bubble.style.left).toBe('')
    expect(bubble.style.right).toBe('24px')
    expect(bubble.style.top).toBe('336px')
    expect(document.querySelector('[data-momo-caption-panel]')).toBeNull()
  })

  it('小幅移动悬浮球仍按点击展开字幕面板处理', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    drag('[data-momo-caption-bubble]', [
      [980, 760],
      [982, 761],
    ])

    expect(document.querySelector('[data-momo-caption-panel]')).not.toBeNull()
  })

  it('拖动字幕面板后状态刷新不会丢失页面内位置', async () => {
    setViewport(1200, 800)
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    clickBubble()
    drag('[data-momo-caption-drag-handle]', [
      [600, 640],
      [520, 420],
    ])

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

    expect(panelStyle().left).toBe('16px')
    expect(panelStyle().top).toBe('316px')
    expect(panelStyle().bottom).toBe('')
    expect(panelStyle().transform).toBe('')
    expect(screenText()).toBe('你好')
  })

  it('点击浏览器 action 消息后展开页面字幕面板', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    listeners.at(-1)?.({ type: 'ui/open-panel' })

    expect(document.querySelector('[data-momo-caption-panel]')).not.toBeNull()
    expect(document.querySelector('[data-momo-caption-bubble]')).toBeNull()
  })

  it('空闲和异常状态在字幕面板内提供开始与重新开始控制', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    clickBubble()

    clickButton('开始翻译')
    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/start' })
    expect(panelText()).toContain('连接腾讯云')
    expect(panelText()).toContain('请稍候')

    listeners.at(-1)?.({
      type: 'speech/snapshot',
      snapshot: {
        status: 'error',
        error: '网络异常',
        sentences: [],
      },
    })

    expect(panelText()).toContain('发生异常')
    expect(panelText()).toContain('网络异常')

    clickButton('重新开始')
    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/start' })
  })

  it('开始翻译失败时在字幕面板展示后台错误', async () => {
    sendMessage.mockResolvedValueOnce({
      ok: false,
      error: '未找到当前标签页',
    })
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    clickBubble()
    clickButton('开始翻译')

    await vi.waitFor(() => {
      expect(panelText()).toContain('发生异常')
      expect(panelText()).toContain('未找到当前标签页')
    })
  })

  it('开始翻译缺少 activeTab 授权时展示插件图标激活提示', async () => {
    sendMessage.mockResolvedValueOnce({
      ok: false,
      error:
        'Extension has not been invoked for the current page (see activeTab permission). Chrome pages cannot be captured.',
    })
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    clickBubble()
    clickButton('开始翻译')

    await vi.waitFor(() => {
      expect(panelText()).toContain(
        '请先点击浏览器工具栏里的莫莫实时字幕图标激活当前页面',
      )
    })
  })

  it('翻译中和暂停状态在字幕面板内提供暂停、继续和停止控制', async () => {
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
    clickBubble()

    expect(panelText()).toContain('翻译中')
    clickButton('暂停')
    clickButton('停止')
    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/pause' })
    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/stop' })

    listeners.at(-1)?.({
      type: 'speech/snapshot',
      snapshot: {
        status: 'paused',
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

    expect(panelText()).toContain('已暂停')
    clickButton('继续')
    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/resume' })
  })

  it('暂停状态下保留悬浮字幕切换能力和最后一句字幕', async () => {
    const { initializeContentScriptOverlay } = await import('./content-script')

    initializeContentScriptOverlay()
    listeners.at(-1)?.({
      type: 'speech/snapshot',
      snapshot: {
        status: 'paused',
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
    clickBubble()

    expect(screenText()).toBe('你好')

    closePanel()
    clickBubble()

    expect(screenText()).toBe('你好')
  })

  it('停止或空闲状态会清空字幕但保留悬浮球', async () => {
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
    clickBubble()

    expect(screenText()).toBe('你好')

    for (const status of ['idle', 'stopping']) {
      listeners.at(-1)?.({
        type: 'speech/snapshot',
        snapshot: {
          status,
          error: null,
          sentences: [],
        },
      })

      expect(
        document.querySelector('[data-momo-caption-bubble]'),
      ).not.toBeNull()
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
      document.querySelectorAll('[data-momo-caption-bubble]'),
    ).toHaveLength(1)
  })
})

function screenText(): string {
  return (
    document.querySelector('[data-momo-caption-overlay]')?.textContent ?? ''
  )
}

function clickBubble(): void {
  document.querySelector<HTMLElement>('[data-momo-caption-bubble]')?.click()
}

function closePanel(): void {
  document.querySelector<HTMLElement>('[data-momo-caption-minimize]')?.click()
}

function clickButton(text: string): void {
  const button = Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent === text,
  )

  if (!button) {
    throw new Error(`找不到按钮：${text}`)
  }

  button.click()
}

function panelText(): string {
  return document.querySelector('[data-momo-caption-panel]')?.textContent ?? ''
}

function panelStyle(): CSSStyleDeclaration {
  const panel = document.querySelector<HTMLElement>('[data-momo-caption-panel]')

  if (!panel) {
    throw new Error('字幕面板不存在')
  }

  return panel.style
}

function getElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector)

  if (!element) {
    throw new Error(`元素不存在：${selector}`)
  }

  return element
}

function drag(selector: string, points: Array<[number, number]>): void {
  const element = getElement(selector)
  const [start, ...moves] = points

  element.dispatchEvent(createPointerEvent('pointerdown', start))
  for (const point of moves) {
    element.dispatchEvent(createPointerEvent('pointermove', point))
  }
  element.dispatchEvent(createPointerEvent('pointerup', moves.at(-1) ?? start))
  element.click()
}

function createPointerEvent(
  type: string,
  [clientX, clientY]: [number, number],
): Event {
  return new MouseEvent(type, {
    bubbles: true,
    clientX,
    clientY,
  })
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  })
}
