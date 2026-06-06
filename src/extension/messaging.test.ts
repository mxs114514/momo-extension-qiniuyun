import { describe, expect, it } from 'vitest'
import {
  isExtensionCommand,
  isExtensionEvent,
  isOffscreenCommand,
} from './messaging'

describe('extension messaging', () => {
  it('accepts known speech commands and rejects unknown messages', () => {
    expect(isExtensionCommand({ type: 'speech/start', tabId: 1 })).toBe(true)
    expect(isExtensionCommand({ type: 'speech/start' })).toBe(true)
    expect(isExtensionCommand({ type: 'ui/open-side-panel' })).toBe(true)
    expect(isExtensionCommand({ type: 'speech/stop' })).toBe(true)
    expect(isExtensionCommand({ type: 'speech/stop', saveHistory: true })).toBe(
      true,
    )
    expect(
      isExtensionCommand({ type: 'speech/stop', saveHistory: false }),
    ).toBe(true)
    expect(
      isExtensionCommand({ type: 'speech/stop', saveHistory: 'yes' }),
    ).toBe(false)
    expect(isExtensionCommand({ type: 'unknown' })).toBe(false)
  })

  it('accepts history commands with valid payloads', () => {
    expect(isExtensionCommand({ type: 'history/list' })).toBe(true)
    expect(isExtensionCommand({ type: 'history/get', sessionId: 's1' })).toBe(
      true,
    )
    expect(
      isExtensionCommand({
        type: 'history/rename',
        sessionId: 's1',
        title: 'React 课程记录',
      }),
    ).toBe(true)
    expect(
      isExtensionCommand({ type: 'history/delete', sessionId: 's1' }),
    ).toBe(true)
    expect(isExtensionCommand({ type: 'history/get', sessionId: '' })).toBe(
      false,
    )
    expect(
      isExtensionCommand({
        type: 'history/rename',
        sessionId: 's1',
        title: '',
      }),
    ).toBe(false)
  })

  it('accepts known offscreen commands', () => {
    expect(
      isOffscreenCommand({
        type: 'offscreen/start-tab-audio',
        streamId: 'stream-id',
      }),
    ).toBe(true)
    expect(isOffscreenCommand({ type: 'offscreen/start-tab-audio' })).toBe(
      false,
    )
  })

  it('accepts history changed events', () => {
    expect(isExtensionEvent({ type: 'history/changed' })).toBe(true)
  })
})
