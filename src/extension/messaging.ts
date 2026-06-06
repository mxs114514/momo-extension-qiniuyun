import type { SpeechTranslationSnapshot } from '../features/speech-translation/types'

/**
 * 从 UI（如侧边栏、内容脚本）发送给扩展后台的控制指令
 */
export type ExtensionCommand =
  | { type: 'speech/start'; tabId?: number }
  | { type: 'speech/pause' }
  | { type: 'speech/resume' }
  | { type: 'speech/stop'; saveHistory?: boolean }
  | { type: 'speech/get-snapshot' }
  | { type: 'ui/open-side-panel' }
  | { type: 'history/list' }
  | { type: 'history/get'; sessionId: string }
  | { type: 'history/rename'; sessionId: string; title: string }
  | { type: 'history/delete'; sessionId: string }

export type ExtensionEvent =
  | { type: 'speech/snapshot'; snapshot: SpeechTranslationSnapshot }
  | { type: 'speech/error'; message: string }

export type OffscreenCommand =
  | { type: 'offscreen/start-tab-audio'; streamId: string }
  | { type: 'offscreen/pause' }
  | { type: 'offscreen/resume' }
  | { type: 'offscreen/stop' }

export type ExtensionMessage =
  | ExtensionCommand
  | ExtensionEvent
  | OffscreenCommand

export function isExtensionCommand(
  message: unknown,
): message is ExtensionCommand {
  if (!isRecord(message) || typeof message.type !== 'string') return false

  switch (message.type) {
    case 'speech/start':
      return (
        message.tabId === undefined ||
        (typeof message.tabId === 'number' &&
          Number.isInteger(message.tabId) &&
          message.tabId > 0)
      )
    case 'speech/stop':
      return (
        message.saveHistory === undefined ||
        typeof message.saveHistory === 'boolean'
      )
    case 'speech/pause':
    case 'speech/resume':
    case 'speech/get-snapshot':
    case 'ui/open-side-panel':
    case 'history/list':
      return true
    case 'history/get':
    case 'history/delete':
      return (
        typeof message.sessionId === 'string' && message.sessionId.length > 0
      )
    case 'history/rename':
      return (
        typeof message.sessionId === 'string' &&
        message.sessionId.length > 0 &&
        typeof message.title === 'string' &&
        message.title.trim().length > 0
      )
    default:
      return false
  }
}

export function isOffscreenCommand(
  message: unknown,
): message is OffscreenCommand {
  if (!isRecord(message) || typeof message.type !== 'string') return false

  switch (message.type) {
    case 'offscreen/start-tab-audio':
      return typeof message.streamId === 'string' && message.streamId.length > 0
    case 'offscreen/pause':
    case 'offscreen/resume':
    case 'offscreen/stop':
      return true
    default:
      return false
  }
}

export function isExtensionEvent(message: unknown): message is ExtensionEvent {
  if (!isRecord(message) || typeof message.type !== 'string') return false

  switch (message.type) {
    case 'speech/snapshot':
      return isRecord(message.snapshot)
    case 'speech/error':
      return typeof message.message === 'string'
    default:
      return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
