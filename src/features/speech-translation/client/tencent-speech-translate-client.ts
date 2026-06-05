import type { TencentSpeechConfig } from '../types'
import type { TranslationUpdate } from '../transcript-store'
import { createSpeechTranslateUrl } from './signature'
import { logSpeechDebug, logSpeechError } from '../debug'

export interface SpeechTranslateEvents {
  onReady: () => void
  onSentence: (update: TranslationUpdate) => void
  onComplete: () => void
  onError: (message: string) => void
}

export interface SpeechTranslateClient {
  connect(): Promise<void>
  sendAudio(chunk: Int8Array): void
  stop(): void
  close(): void
}

interface SocketLike {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  send(data: string | ArrayBufferView | ArrayBuffer | Blob): void
  close(code?: number, reason?: string): void
}

interface ClientDependencies {
  createWebSocket?: (url: string) => SocketLike
  createUrl?: typeof createSpeechTranslateUrl
}

type TencentResponse = {
  code: number
  message?: string
  final?: number
  sentence_id?: string | number
  result?: {
    source_text: string
    target_text: string
    start_time: number
    end_time: number
    sentence_end: boolean
  }
}

export class TencentSpeechTranslateClient implements SpeechTranslateClient {
  private socket: SocketLike | null = null
  private completed = false
  private ready = false
  private sentAudioPackets = 0
  private readonly config: TencentSpeechConfig
  private readonly events: SpeechTranslateEvents
  private readonly dependencies: ClientDependencies

  constructor(
    config: TencentSpeechConfig,
    events: SpeechTranslateEvents,
    dependencies: ClientDependencies = {},
  ) {
    this.config = config
    this.events = events
    this.dependencies = dependencies
  }

  async connect(): Promise<void> {
    if (this.socket) return

    const createUrl = this.dependencies.createUrl ?? createSpeechTranslateUrl
    logSpeechDebug('腾讯云：正在生成签名')
    const { url } = await createUrl(this.config)
    const createSocket =
      this.dependencies.createWebSocket ??
      ((socketUrl: string) => new WebSocket(socketUrl))
    const socket = createSocket(url)
    logSpeechDebug('腾讯云：WebSocket 已创建')
    this.socket = socket
    socket.onopen = () => logSpeechDebug('腾讯云：WebSocket 已连接')
    socket.onmessage = (event) => this.handleMessage(event)
    socket.onerror = () => this.fail('网络连接异常，请重新开始')
    socket.onclose = (event) => {
      logSpeechDebug('腾讯云：WebSocket 已关闭', {
        code: event.code,
        normal: event.code === 1000,
      })
      if (!this.completed && event.code !== 1000) {
        this.fail('网络连接已断开，请重新开始', false)
      }
      this.socket = null
    }
  }

  sendAudio(chunk: Int8Array): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(chunk)
      this.sentAudioPackets += 1
      if (this.sentAudioPackets === 1) {
        logSpeechDebug('腾讯云：已发送首个音频包', {
          bytes: chunk.byteLength,
        })
      }
    }
  }

  stop(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'end' }))
    }
  }

  close(): void {
    this.completed = true
    this.socket?.close(1000)
    this.socket = null
  }

  private handleMessage(event: MessageEvent): void {
    let response: TencentResponse
    try {
      response = JSON.parse(String(event.data)) as TencentResponse
    } catch {
      this.fail('腾讯云返回了无法解析的响应')
      return
    }

    if (response.code !== 0) {
      logSpeechError('腾讯云返回错误', {
        code: response.code,
        message: response.message,
      })
      const message =
        response.code === 6002
          ? '腾讯云鉴权失败，请检查凭证'
          : `腾讯云服务异常（错误码 ${response.code}）`
      this.fail(message)
      return
    }

    if (!this.ready) {
      this.ready = true
      this.events.onReady()
    }

    if (response.final === 1) {
      logSpeechDebug('腾讯云：收到会话最终响应')
      this.completed = true
      this.events.onComplete()
      this.socket?.close(1000)
      return
    }

    if (response.result && response.sentence_id !== undefined) {
      this.events.onSentence({
        sentenceId: String(response.sentence_id),
        sourceText: response.result.source_text,
        targetText: response.result.target_text,
        startTime: response.result.start_time,
        endTime: response.result.end_time,
        sentenceEnd: response.result.sentence_end,
      })
    }
  }

  private fail(message: string, close = true): void {
    logSpeechError(message)
    this.events.onError(message)
    if (close) {
      this.completed = true
      this.socket?.close(1000)
    }
  }
}
