import type { AudioSource } from './audio/audio-source'
import type {
  SpeechTranslateClient,
  SpeechTranslateEvents,
} from './client/tencent-speech-translate-client'
import type { SpeechTranslationSnapshot, TranslationStatus } from './types'
import { TranscriptStore } from './transcript-store'
import { logSpeechDebug, logSpeechError } from './debug'

interface ControllerDependencies {
  audioSource: AudioSource
  transcriptStore: TranscriptStore
  createClient: (events: SpeechTranslateEvents) => SpeechTranslateClient
  stopTimeoutMs?: number
}

export class SpeechTranslationController {
  private readonly audioSource: AudioSource
  private readonly transcriptStore: TranscriptStore
  private readonly createClient: ControllerDependencies['createClient']
  private readonly stopTimeoutMs: number
  private readonly listeners = new Set<() => void>()
  private snapshot: SpeechTranslationSnapshot = {
    status: 'idle',
    sentences: [],
    error: null,
  }
  private client: SpeechTranslateClient | null = null
  private canSendAudio = false
  private stopPromise: Promise<void> | null = null
  private resolveStop: (() => void) | null = null
  private stopTimer: ReturnType<typeof setTimeout> | null = null

  constructor(dependencies: ControllerDependencies) {
    this.audioSource = dependencies.audioSource
    this.transcriptStore = dependencies.transcriptStore
    this.createClient = dependencies.createClient
    this.stopTimeoutMs = dependencies.stopTimeoutMs ?? 5000
  }

  getSnapshot = (): SpeechTranslationSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(): Promise<void> {
    if (!['idle', 'error'].includes(this.snapshot.status)) {
      logSpeechDebug(`忽略重复开始，当前状态：${this.snapshot.status}`)
      return
    }
    logSpeechDebug('开始：正在请求麦克风权限')
    this.transcriptStore.clear()
    this.setSnapshot('requesting-permission', null)

    const events: SpeechTranslateEvents = {
      onReady: () => {
        logSpeechDebug('腾讯云握手成功，开始发送音频')
        this.canSendAudio = true
        this.setSnapshot('translating', null)
      },
      onSentence: (update) => {
        logSpeechDebug('收到翻译句子', {
          sentenceId: update.sentenceId,
          final: update.sentenceEnd,
        })
        this.transcriptStore.update(update)
        this.setSnapshot(this.snapshot.status, this.snapshot.error)
      },
      onComplete: () => this.finishStop(),
      onError: (message) => {
        void this.handleError(message)
      },
    }
    try {
      this.client = this.createClient(events)
      await this.audioSource.start((chunk) => {
        if (this.canSendAudio) this.client?.sendAudio(chunk)
      })
      logSpeechDebug('麦克风准备完成，正在连接腾讯云')
      this.setSnapshot('connecting', null)
      await this.client.connect()
    } catch (error) {
      logSpeechError('启动失败', error)
      await this.handleError(toUserFacingStartupError(error))
    }
  }

  async pause(): Promise<void> {
    if (this.snapshot.status !== 'translating') return
    logSpeechDebug('暂停翻译')
    this.canSendAudio = false
    await this.audioSource.pause()
    this.setSnapshot('paused', null)
  }

  async resume(): Promise<void> {
    if (this.snapshot.status !== 'paused') return
    logSpeechDebug('继续翻译')
    await this.audioSource.resume()
    this.canSendAudio = true
    this.setSnapshot('translating', null)
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise
    if (
      !['translating', 'paused', 'connecting'].includes(this.snapshot.status)
    ) {
      return
    }

    this.canSendAudio = false
    logSpeechDebug('停止：正在释放麦克风并结束腾讯云会话')
    this.setSnapshot('stopping', null)
    this.stopPromise = new Promise<void>((resolve) => {
      this.resolveStop = resolve
    })
    await this.audioSource.stop()
    this.client?.stop()
    this.stopTimer = setTimeout(() => {
      logSpeechDebug('等待最终响应超时，强制关闭连接')
      this.client?.close()
      this.finishStop()
    }, this.stopTimeoutMs)
    return this.stopPromise
  }

  async dispose(): Promise<void> {
    logSpeechDebug('释放翻译资源')
    this.canSendAudio = false
    await this.audioSource.stop()
    this.client?.close()
    this.client = null
    this.finishStop()
  }

  private async handleError(message: string): Promise<void> {
    logSpeechError(message)
    this.canSendAudio = false
    this.setSnapshot('error', message)
    await this.audioSource.stop()
    this.client?.close()
    this.client = null
    this.clearStopTimer()
    this.resolveStop?.()
    this.stopPromise = null
    this.resolveStop = null
  }

  private finishStop(): void {
    logSpeechDebug('翻译会话已结束')
    this.clearStopTimer()
    this.canSendAudio = false
    this.client = null
    this.setSnapshot('idle', null)
    this.resolveStop?.()
    this.stopPromise = null
    this.resolveStop = null
  }

  private setSnapshot(status: TranslationStatus, error: string | null): void {
    this.snapshot = {
      status,
      error,
      sentences: this.transcriptStore.getSentences(),
    }
    this.listeners.forEach((listener) => listener())
  }

  private clearStopTimer(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }
  }
}

function toUserFacingStartupError(error: unknown): string {
  if (error instanceof Error && isGuidedChineseError(error.message)) {
    return error.message
  }

  return '启动实时翻译失败，请刷新页面并检查音频权限、网络连接后重试。'
}

function isGuidedChineseError(message: string): boolean {
  return /[\u4e00-\u9fff]/.test(message) && message.includes('请')
}
