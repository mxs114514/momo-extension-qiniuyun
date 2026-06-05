import { describe, expect, it, vi } from 'vitest'
import { TencentSpeechTranslateClient } from './tencent-speech-translate-client'

class FakeWebSocket {
  static readonly OPEN = 1
  readyState = FakeWebSocket.OPEN
  sent: unknown[] = []
  closed: Array<[number?, string?]> = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  send(data: unknown) {
    this.sent.push(data)
  }

  close(code?: number, reason?: string) {
    this.closed.push([code, reason])
  }

  open() {
    this.onopen?.(new Event('open'))
  }

  message(data: unknown) {
    this.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify(data) }),
    )
  }

  closeUnexpectedly() {
    this.onclose?.(new CloseEvent('close', { code: 1006 }))
  }
}

const config = {
  appId: '123',
  secretId: 'id',
  secretKey: 'key',
  source: 'en' as const,
  target: 'zh' as const,
  voiceFormat: 1 as const,
  translationModel: 'hunyuan-translation-lite' as const,
}

function setup() {
  const socket = new FakeWebSocket()
  const events = {
    onReady: vi.fn(),
    onSentence: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
  }
  const client = new TencentSpeechTranslateClient(config, events, {
    createWebSocket: () => socket,
    createUrl: async () => ({ url: 'wss://example.test', signingText: '' }),
  })
  return { client, events, socket }
}

describe('TencentSpeechTranslateClient', () => {
  it('连接成功并收到握手消息后发出 ready', async () => {
    const { client, events, socket } = setup()
    await client.connect()
    socket.open()
    socket.message({ code: 0, message: 'success' })
    expect(events.onReady).toHaveBeenCalledOnce()
  })

  it('发送音频、解析句子并正常结束', async () => {
    const { client, events, socket } = setup()
    await client.connect()
    socket.open()
    const chunk = new Int8Array([1, 2])
    client.sendAudio(chunk)
    expect(socket.sent[0]).toBe(chunk)

    socket.message({
      code: 0,
      sentence_id: 's1',
      result: {
        source_text: 'Hello',
        target_text: '你好',
        start_time: 0,
        end_time: 100,
        sentence_end: true,
      },
    })
    expect(events.onSentence).toHaveBeenCalledWith({
      sentenceId: 's1',
      sourceText: 'Hello',
      targetText: '你好',
      startTime: 0,
      endTime: 100,
      sentenceEnd: true,
    })

    client.stop()
    expect(socket.sent.at(-1)).toBe('{"type":"end"}')
    expect(socket.closed).toEqual([])
    socket.message({ code: 0, final: 1 })
    expect(events.onComplete).toHaveBeenCalledOnce()
    expect(socket.closed).toEqual([[1000, undefined]])
  })

  it('将服务错误和异常关闭转换为中文错误', async () => {
    const { client, events, socket } = setup()
    await client.connect()
    socket.open()
    socket.message({ code: 6002, message: 'auth failed' })
    expect(events.onError).toHaveBeenCalledWith('腾讯云鉴权失败，请检查凭证')

    const second = setup()
    await second.client.connect()
    second.socket.open()
    second.socket.closeUnexpectedly()
    expect(second.events.onError).toHaveBeenCalledWith(
      '网络连接已断开，请重新开始',
    )
  })
})
