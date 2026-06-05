import { describe, expect, it } from 'vitest'
import { isExtensionCommand, isOffscreenCommand } from './messaging'

describe('extension messaging', () => {
  it('accepts known speech commands and rejects unknown messages', () => {
    expect(isExtensionCommand({ type: 'speech/start', tabId: 1 })).toBe(true)
    expect(isExtensionCommand({ type: 'speech/stop' })).toBe(true)
    expect(isExtensionCommand({ type: 'speech/start' })).toBe(false)
    expect(isExtensionCommand({ type: 'unknown' })).toBe(false)
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
})
