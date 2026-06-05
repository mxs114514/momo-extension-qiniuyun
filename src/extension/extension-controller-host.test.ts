import { describe, expect, it, vi } from 'vitest'
import { ExtensionControllerHost } from './extension-controller-host'
import type { SpeechTranslationSnapshot } from '../features/speech-translation/types'

interface FakeController {
  start: ReturnType<typeof vi.fn<() => Promise<void>>>
  pause: ReturnType<typeof vi.fn<() => Promise<void>>>
  resume: ReturnType<typeof vi.fn<() => Promise<void>>>
  stop: ReturnType<typeof vi.fn<() => Promise<void>>>
  dispose: ReturnType<typeof vi.fn<() => Promise<void>>>
  getSnapshot: () => SpeechTranslationSnapshot
  subscribe: (listener: () => void) => () => void
  emit: () => void
}

function createFakeController(): FakeController {
  let listener: (() => void) | null = null
  const snapshot: SpeechTranslationSnapshot = {
    status: 'translating',
    sentences: [
      {
        id: '1',
        sourceText: 'hello',
        targetText: '你好',
        startTime: 0,
        endTime: 100,
        isFinal: false,
      },
    ],
    error: null,
  }

  return {
    start: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
    getSnapshot: () => snapshot,
    subscribe: (nextListener) => {
      listener = nextListener
      return () => {
        listener = null
      }
    },
    emit: () => listener?.(),
  }
}

describe('ExtensionControllerHost', () => {
  it('creates one controller for an active session and emits snapshots', async () => {
    const controller = createFakeController()
    const sendEvent = vi.fn()
    const createController = vi.fn(() => controller)
    const host = new ExtensionControllerHost({ createController, sendEvent })

    await host.handleCommand({ type: 'speech/start', tabId: 1 })
    await host.handleCommand({ type: 'speech/start', tabId: 1 })
    controller.emit()

    expect(createController).toHaveBeenCalledOnce()
    expect(controller.start).toHaveBeenCalledOnce()
    expect(sendEvent).toHaveBeenCalledWith({
      type: 'speech/snapshot',
      snapshot: controller.getSnapshot(),
    })
  })

  it('routes pause, resume and stop, then disposes active controller', async () => {
    const controller = createFakeController()
    const host = new ExtensionControllerHost({
      createController: () => controller,
      sendEvent: vi.fn(),
    })

    await host.handleCommand({ type: 'speech/start', tabId: 1 })
    await host.handleCommand({ type: 'speech/pause' })
    await host.handleCommand({ type: 'speech/resume' })
    await host.handleCommand({ type: 'speech/stop' })

    expect(controller.pause).toHaveBeenCalledOnce()
    expect(controller.resume).toHaveBeenCalledOnce()
    expect(controller.stop).toHaveBeenCalledOnce()
    expect(controller.dispose).toHaveBeenCalledOnce()
  })

  it('sends Chinese errors and cleans up when controller commands fail', async () => {
    const controller = createFakeController()
    controller.start.mockRejectedValueOnce(new Error('启动失败'))
    const sendEvent = vi.fn()
    const host = new ExtensionControllerHost({
      createController: () => controller,
      sendEvent,
    })

    await host.handleCommand({ type: 'speech/start', tabId: 1 })

    expect(sendEvent).toHaveBeenCalledWith({
      type: 'speech/error',
      message: '启动失败',
    })
    expect(controller.dispose).toHaveBeenCalledOnce()
  })
})
