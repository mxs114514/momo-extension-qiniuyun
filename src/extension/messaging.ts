import type { SpeechTranslationSnapshot } from '../features/speech-translation/types'

export type ExtensionCommand =
  | { type: 'speech/start'; tabId: number }
  | { type: 'speech/pause' }
  | { type: 'speech/resume' }
  | { type: 'speech/stop' }
  | { type: 'speech/get-snapshot' }

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
        typeof message.tabId === 'number' &&
        Number.isInteger(message.tabId) &&
        message.tabId > 0
      )
    case 'speech/pause':
    case 'speech/resume':
    case 'speech/stop':
    case 'speech/get-snapshot':
      return true
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
