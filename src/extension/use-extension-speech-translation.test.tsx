import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExtensionSpeechTranslation } from './use-extension-speech-translation'

type MessageListener = (message: unknown) => void

const listeners: MessageListener[] = []
const sendMessage = vi.fn()
const query = vi.fn()

beforeEach(() => {
  listeners.length = 0
  sendMessage.mockReset()
  query.mockReset()
  query.mockResolvedValue([{ id: 9 }])
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
      onMessage: {
        addListener: (listener: MessageListener) => {
          listeners.push(listener)
        },
        removeListener: (listener: MessageListener) => {
          const index = listeners.indexOf(listener)
          if (index >= 0) listeners.splice(index, 1)
        },
      },
    },
    tabs: {
      query,
    },
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useExtensionSpeechTranslation', () => {
  it('requests snapshot on mount and subscribes to snapshot events', () => {
    const { result } = renderHook(() => useExtensionSpeechTranslation())

    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/get-snapshot' })

    act(() => {
      listeners[0]?.({
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
    })

    expect(result.current.snapshot.status).toBe('translating')
    expect(result.current.snapshot.sentences[0].targetText).toBe('你好')
  })

  it('忽略历史记录变化事件', () => {
    const { result } = renderHook(() => useExtensionSpeechTranslation())

    act(() => {
      listeners[0]?.({ type: 'history/changed' })
    })

    expect(result.current.snapshot.status).toBe('idle')
    expect(result.current.snapshot.error).toBeNull()
  })

  it('sends start with current active tab id and routes controls', async () => {
    const { result } = renderHook(() => useExtensionSpeechTranslation())

    await act(async () => {
      await result.current.start()
      await result.current.pause()
      await result.current.resume()
      await result.current.stop()
    })

    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true })
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'speech/start',
      tabId: 9,
    })
    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/pause' })
    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/resume' })
    expect(sendMessage).toHaveBeenCalledWith({ type: 'speech/stop' })
  })
})
