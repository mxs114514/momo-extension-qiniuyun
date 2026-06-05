/**
 * 离屏页面 (Offscreen Document) 脚本。
 * 由于 Chrome 的 Service Worker 无法直接使用 Web Audio API，
 * 我们需要在此离屏页面中接收来自后台的信号，以处理标签页音频并在前端环境进行实时翻译。
 */
import { createTabSpeechTranslationController } from '../features/speech-translation/create-speech-translation'
import { logSpeechError } from '../features/speech-translation/debug'
import type { SpeechTranslationSnapshot } from '../features/speech-translation/types'
import {
  isExtensionCommand,
  isExtensionEvent,
  isOffscreenCommand,
} from './messaging'

interface OffscreenController {
  start: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  dispose: () => Promise<void>
  getSnapshot: () => SpeechTranslationSnapshot
  subscribe: (listener: () => void) => () => void
}

interface OffscreenDependencies {
  createControllerFromStreamId: (streamId: string) => OffscreenController
}

type ChromeApi = {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown> | void
    onMessage: {
      addListener: (listener: (message: unknown) => void) => void
    }
  }
}

export function initializeOffscreenRuntime(
  dependencies: OffscreenDependencies = {
    createControllerFromStreamId: createTabSpeechTranslationController,
  },
): void {
  let controller: OffscreenController | null = null
  let unsubscribe: (() => void) | null = null

  const cleanup = async () => {
    unsubscribe?.()
    unsubscribe = null
    const current = controller
    controller = null
    await current?.dispose()
  }

  const sendSnapshot = () => {
    if (!controller) return
    void getChrome().runtime.sendMessage({
      type: 'speech/snapshot',
      snapshot: controller.getSnapshot(),
    })
  }

  getChrome().runtime.onMessage.addListener((message) => {
    void (async () => {
      if (isExtensionCommand(message) || isExtensionEvent(message)) {
        return
      }

      if (!isOffscreenCommand(message)) {
        throw new Error('不支持的离屏消息')
      }

      switch (message.type) {
        case 'offscreen/start-tab-audio':
          await cleanup()
          controller = dependencies.createControllerFromStreamId(
            message.streamId,
          )
          unsubscribe = controller.subscribe(sendSnapshot)
          await controller.start()
          break
        case 'offscreen/pause':
          await controller?.pause()
          break
        case 'offscreen/resume':
          await controller?.resume()
          break
        case 'offscreen/stop':
          await controller?.stop()
          await cleanup()
          break
      }
    })().catch((error) => {
      const messageText =
        error instanceof Error ? error.message : '离屏运行时处理失败'
      logSpeechError(messageText)
      void getChrome().runtime.sendMessage({
        type: 'speech/error',
        message: messageText,
      })
    })
  })
}

function getChrome(): ChromeApi {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi })
    .chrome
  if (!chromeApi) throw new Error('当前环境不支持扩展 API')
  return chromeApi
}

if (
  (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome?.runtime
) {
  initializeOffscreenRuntime()
}
