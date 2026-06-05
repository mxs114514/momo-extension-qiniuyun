import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeechTranslationSnapshot } from '../features/speech-translation/types'
import { initializeOffscreenRuntime } from './offscreen'

type MessageListener = (message: unknown) => void

const listeners: MessageListener[] = []
const sendMessage = vi.fn()

function createController() {
  let listener: (() => void) | null = null
  const snapshot: SpeechTranslationSnapshot = {
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
  }
  return {
    start: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
    getSnapshot: () => snapshot,
    subscribe: (nextListener: () => void) => {
      listener = nextListener
      return () => {
        listener = null
      }
    },
    emit: () => listener?.(),
  }
}

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
  vi.unstubAllGlobals()
})

describe('offscreen runtime', () => {
  it('starts tab audio controller and emits snapshots through runtime messaging', async () => {
    const controller = createController()
    const createControllerFromStreamId = vi.fn(() => controller)
    initializeOffscreenRuntime({ createControllerFromStreamId })

    listeners[0]?.({
      type: 'offscreen/start-tab-audio',
      streamId: 'stream-id',
    })
    await vi.waitFor(() => {
      expect(createControllerFromStreamId).toHaveBeenCalledWith('stream-id')
      expect(controller.start).toHaveBeenCalledOnce()
    })

    controller.emit()

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'speech/snapshot',
      snapshot: controller.getSnapshot(),
    })
  })

  it('routes pause, resume and stop, then disposes resources', async () => {
    const controller = createController()
    initializeOffscreenRuntime({
      createControllerFromStreamId: () => controller,
    })

    listeners[0]?.({ type: 'offscreen/start-tab-audio', streamId: 'stream-id' })
    await vi.waitFor(() => expect(controller.start).toHaveBeenCalledOnce())
    listeners[0]?.({ type: 'offscreen/pause' })
    listeners[0]?.({ type: 'offscreen/resume' })
    listeners[0]?.({ type: 'offscreen/stop' })

    await vi.waitFor(() => {
      expect(controller.pause).toHaveBeenCalledOnce()
      expect(controller.resume).toHaveBeenCalledOnce()
      expect(controller.stop).toHaveBeenCalledOnce()
      expect(controller.dispose).toHaveBeenCalledOnce()
    })
  })

  it('converts unknown messages to Chinese errors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    initializeOffscreenRuntime({
      createControllerFromStreamId: () => createController(),
    })

    listeners[0]?.({ type: 'unknown' })

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'speech/error',
        message: '不支持的离屏消息',
      })
      expect(error).toHaveBeenCalledWith('[实时翻译]', '不支持的离屏消息')
    })
  })
})
