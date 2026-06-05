import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

beforeEach(() => {
  listener = null
  sendMessage.mockReset()
  sendResponse.mockReset()
  query.mockReset()
  sendTabMessage.mockReset()
  getMediaStreamId.mockReset()
  createDocument.mockReset()
  hasDocument.mockReset()
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (nextListener: RuntimeListener) => {
          listener = nextListener
        },
      },
      sendMessage,
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
})
