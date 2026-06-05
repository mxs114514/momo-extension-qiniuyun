import { describe, expect, it, vi } from 'vitest'
import type { AudioSource } from './audio/audio-source'
import type {
  SpeechTranslateClient,
  SpeechTranslateEvents,
} from './client/tencent-speech-translate-client'
import { SpeechTranslationController } from './speech-translation-controller'
import { TranscriptStore } from './transcript-store'

function setup() {
  let onChunk: ((chunk: Int8Array) => void) | null = null
  let events: SpeechTranslateEvents | null = null
  const calls: string[] = []
  const audioSource: AudioSource = {
    start: vi.fn(async (listener) => {
      calls.push('audio.start')
      onChunk = listener
    }),
    pause: vi.fn(async () => {
      calls.push('audio.pause')
    }),
    resume: vi.fn(async () => {
      calls.push('audio.resume')
    }),
    stop: vi.fn(async () => {
      calls.push('audio.stop')
    }),
  }
  const client: SpeechTranslateClient = {
    connect: vi.fn(async () => {
      calls.push('client.connect')
    }),
    sendAudio: vi.fn(),
    stop: vi.fn(() => {
      calls.push('client.stop')
    }),
    close: vi.fn(() => {
      calls.push('client.close')
    }),
  }
  const controller = new SpeechTranslationController({
    audioSource,
    transcriptStore: new TranscriptStore(),
    createClient: (clientEvents) => {
      events = clientEvents
      return client
    },
    stopTimeoutMs: 10,
  })
  return {
    audioSource,
    calls,
    client,
    controller,
    emitAudio: (chunk: Int8Array) => onChunk?.(chunk),
    events: () => {
      if (!events) throw new Error('客户端尚未创建')
      return events
    },
  }
}

describe('SpeechTranslationController', () => {
  it('协调启动、音频、字幕、暂停恢复和完成', async () => {
    const fixture = setup()
    const snapshots: string[] = []
    fixture.controller.subscribe(() => {
      snapshots.push(fixture.controller.getSnapshot().status)
    })

    await fixture.controller.start()
    expect(snapshots).toEqual(['requesting-permission', 'connecting'])
    fixture.emitAudio(new Int8Array([1]))
    expect(fixture.client.sendAudio).not.toHaveBeenCalled()

    fixture.events().onReady()
    expect(fixture.controller.getSnapshot().status).toBe('translating')
    fixture.emitAudio(new Int8Array([2]))
    expect(fixture.client.sendAudio).toHaveBeenCalledWith(new Int8Array([2]))

    fixture.events().onSentence({
      sentenceId: '1',
      sourceText: 'Hello',
      targetText: '你好',
      startTime: 0,
      endTime: 100,
      sentenceEnd: true,
    })
    expect(fixture.controller.getSnapshot().sentences[0].targetText).toBe(
      '你好',
    )

    await fixture.controller.pause()
    expect(fixture.controller.getSnapshot().status).toBe('paused')
    await fixture.controller.resume()
    expect(fixture.controller.getSnapshot().status).toBe('translating')

    const stopping = fixture.controller.stop()
    await Promise.resolve()
    expect(fixture.calls.slice(-2)).toEqual(['audio.stop', 'client.stop'])
    fixture.events().onComplete()
    await stopping
    expect(fixture.controller.getSnapshot().status).toBe('idle')
    expect(fixture.controller.getSnapshot().sentences).toHaveLength(1)
  })

  it('停止超时后强制关闭客户端', async () => {
    vi.useFakeTimers()
    const fixture = setup()
    await fixture.controller.start()
    fixture.events().onReady()
    const stopping = fixture.controller.stop()
    await vi.advanceTimersByTimeAsync(10)
    await stopping
    expect(fixture.client.close).toHaveBeenCalledOnce()
    expect(fixture.controller.getSnapshot().status).toBe('idle')
    vi.useRealTimers()
  })

  it('错误时清理资源并进入 error', async () => {
    const fixture = setup()
    await fixture.controller.start()
    fixture.events().onError('连接失败')
    await Promise.resolve()
    expect(fixture.audioSource.stop).toHaveBeenCalled()
    expect(fixture.client.close).toHaveBeenCalled()
    expect(fixture.controller.getSnapshot()).toMatchObject({
      status: 'error',
      error: '连接失败',
    })
  })

  it('dispose 不清空由订阅方管理的监听器', async () => {
    const fixture = setup()
    const listener = vi.fn()
    fixture.controller.subscribe(listener)

    await fixture.controller.dispose()
    listener.mockClear()
    await fixture.controller.start()

    expect(listener).toHaveBeenCalled()
  })

  it('输出不含凭证的中文流程日志', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const fixture = setup()

    await fixture.controller.start()

    expect(info).toHaveBeenCalledWith(
      '[实时翻译]',
      '开始：正在请求麦克风权限',
    )
  })
})
