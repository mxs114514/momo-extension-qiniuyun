import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const historyStore = vi.hoisted(() => ({
  saveSession: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  renameSession: vi.fn(),
  deleteSession: vi.fn(),
}))

vi.mock('../features/session-history/default-history-store', () => ({
  sessionHistoryStore: historyStore,
}))

type RuntimeListener = (
  message: unknown,
  sender: { tab?: { id?: number } },
  sendResponse: (response: unknown) => void,
) => boolean | void

let listener: RuntimeListener | null = null
const sendMessage = vi.fn()
const sendResponse = vi.fn()
const query = vi.fn()
const sendTabMessage = vi.fn()
const getMediaStreamId = vi.fn()
const createDocument = vi.fn()
const hasDocument = vi.fn()
const openSidePanel = vi.fn()
let actionClickListener: (() => void) | null = null

beforeEach(() => {
  listener = null
  actionClickListener = null
  sendMessage.mockReset()
  sendResponse.mockReset()
  query.mockReset()
  sendTabMessage.mockReset()
  getMediaStreamId.mockReset()
  createDocument.mockReset()
  hasDocument.mockReset()
  openSidePanel.mockReset()
  historyStore.saveSession.mockReset()
  historyStore.listSessions.mockReset()
  historyStore.getSession.mockReset()
  historyStore.renameSession.mockReset()
  historyStore.deleteSession.mockReset()
  query.mockResolvedValue([])
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (nextListener: RuntimeListener) => {
          listener = nextListener
        },
      },
      sendMessage,
    },
    action: {
      onClicked: {
        addListener: (nextListener: () => void) => {
          actionClickListener = nextListener
        },
      },
    },
    tabs: {
      query,
      sendMessage: sendTabMessage,
    },
    tabCapture: {
      getMediaStreamId,
    },
    offscreen: {
      createDocument,
      hasDocument,
    },
    sidePanel: {
      open: openSidePanel,
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('background service worker', () => {
  it('captures active tab audio and starts the offscreen document', async () => {
    hasDocument.mockResolvedValue(false)
    query.mockResolvedValue([{ id: 12 }])
    getMediaStreamId.mockResolvedValue('stream-id')
    await import('./background')

    const keepChannelOpen = listener?.(
      { type: 'speech/start', tabId: 12 },
      {},
      sendResponse,
    )

    expect(keepChannelOpen).toBe(true)
    await vi.waitFor(() => {
      expect(query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      })
      expect(getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 12 })
      expect(createDocument).toHaveBeenCalledWith({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification:
          'Capture current tab audio and translate it in real time.',
      })
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'offscreen/start-tab-audio',
        streamId: 'stream-id',
      })
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
  })

  it('uses the sender tab when starting from a content script panel', async () => {
    hasDocument.mockResolvedValue(true)
    query.mockResolvedValue([])
    getMediaStreamId.mockResolvedValue('stream-id')
    await import('./background')

    listener?.({ type: 'speech/start' }, { tab: { id: 18 } }, sendResponse)

    await vi.waitFor(() => {
      expect(getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 18 })
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'offscreen/start-tab-audio',
        streamId: 'stream-id',
      })
    })
  })

  it('opens the page panel when the extension action is clicked', async () => {
    query.mockResolvedValue([{ id: 31 }])
    await import('./background')

    actionClickListener?.()

    await vi.waitFor(() => {
      expect(sendTabMessage).toHaveBeenCalledWith(31, {
        type: 'ui/open-panel',
      })
    })
  })

  it('opens the browser side panel when requested from the content script', async () => {
    await import('./background')

    listener?.(
      { type: 'ui/open-side-panel' },
      { tab: { id: 42 } },
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(openSidePanel).toHaveBeenCalledWith({ tabId: 42 })
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
  })

  it('forwards pause, resume and stop commands to offscreen runtime', async () => {
    hasDocument.mockResolvedValue(true)
    await import('./background')

    listener?.({ type: 'speech/pause' }, {}, sendResponse)
    listener?.({ type: 'speech/resume' }, {}, sendResponse)
    listener?.({ type: 'speech/stop' }, {}, sendResponse)

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'offscreen/pause' })
      expect(sendMessage).toHaveBeenCalledWith({ type: 'offscreen/resume' })
      expect(sendMessage).toHaveBeenCalledWith({ type: 'offscreen/stop' })
    })
  })

  it('saves the final idle snapshot when stop requested history saving', async () => {
    hasDocument.mockResolvedValue(true)
    await import('./background')
    const sentences = [
      {
        id: '1',
        sourceText: 'hello',
        targetText: '你好',
        startTime: 0,
        endTime: 1,
        isFinal: true,
      },
    ]

    listener?.({ type: 'speech/stop', saveHistory: true }, {}, sendResponse)
    listener?.(
      {
        type: 'speech/snapshot',
        snapshot: {
          status: 'idle',
          error: null,
          sentences,
        },
      },
      {},
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'offscreen/stop' })
      expect(historyStore.saveSession).toHaveBeenCalledWith({
        now: expect.any(Number),
        sentences,
      })
    })
  })

  it('does not save the final idle snapshot when stop discards history', async () => {
    hasDocument.mockResolvedValue(true)
    await import('./background')

    listener?.({ type: 'speech/stop', saveHistory: false }, {}, sendResponse)
    listener?.(
      {
        type: 'speech/snapshot',
        snapshot: {
          status: 'idle',
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
          ],
        },
      },
      {},
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(historyStore.saveSession).not.toHaveBeenCalled()
    })
  })

  it('returns history list data from the session history store', async () => {
    const sessions = [
      {
        id: 's1',
        title: 'React 课程记录',
        createdAt: 1,
        updatedAt: 1,
        summary: '你好',
        sentenceCount: 1,
      },
    ]
    historyStore.listSessions.mockResolvedValue(sessions)
    await import('./background')

    listener?.({ type: 'history/list' }, {}, sendResponse)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        data: sessions,
      })
    })
  })

  it('returns a Chinese error for unsupported commands', async () => {
    await import('./background')

    listener?.({ type: 'unknown' }, {}, sendResponse)
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: '不支持的扩展消息',
      })
    })
  })

  it('caches offscreen snapshots and returns them to newly opened UI', async () => {
    query.mockResolvedValue([{ id: 21 }])
    await import('./background')
    const snapshot = {
      status: 'translating',
      error: null,
      sentences: [],
    }

    listener?.({ type: 'speech/snapshot', snapshot }, {}, sendResponse)
    listener?.({ type: 'speech/get-snapshot' }, {}, sendResponse)

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'speech/snapshot',
        snapshot,
      })
      expect(sendTabMessage).toHaveBeenCalledWith(21, {
        type: 'speech/snapshot',
        snapshot,
      })
    })
  })

  it('routes history detail, rename and delete commands to the session history store', async () => {
    const session = {
      id: 's1',
      title: 'React 课程记录',
      createdAt: 1,
      updatedAt: 1,
      summary: '你好',
      sentences: [],
    }
    historyStore.getSession.mockResolvedValue(session)
    await import('./background')

    listener?.({ type: 'history/get', sessionId: 's1' }, {}, sendResponse)
    listener?.(
      {
        type: 'history/rename',
        sessionId: 's1',
        title: '新标题',
      },
      {},
      sendResponse,
    )
    listener?.({ type: 'history/delete', sessionId: 's1' }, {}, sendResponse)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        data: session,
      })
      expect(historyStore.renameSession).toHaveBeenCalledWith('s1', '新标题')
      expect(historyStore.deleteSession).toHaveBeenCalledWith('s1')
    })
  })
})
