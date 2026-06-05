import type { AudioSource } from './audio-source'
import { audioWorkletCode } from './audio-worklet-code'
import { downsampleTo16k, float32ToPcm16, PcmChunker } from './pcm'
import { logSpeechDebug, logSpeechError } from '../debug'

interface TabAudioDependencies {
  getUserMedia: typeof navigator.mediaDevices.getUserMedia
  createAudioContext: () => AudioContext
  createWorkletNode: (context: AudioContext) => AudioWorkletNode
  createObjectURL: typeof URL.createObjectURL
  revokeObjectURL: typeof URL.revokeObjectURL
}

function defaultDependencies(): TabAudioDependencies {
  return {
    getUserMedia: (constraints) =>
      navigator.mediaDevices.getUserMedia(constraints),
    createAudioContext: () => new AudioContext(),
    createWorkletNode: (context) =>
      new AudioWorkletNode(context, 'speech-pcm-processor'),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  }
}

export class TabAudioSource implements AudioSource {
  private readonly streamId: string
  private readonly dependencies: TabAudioDependencies
  private readonly chunker = new PcmChunker()
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private workletUrl: string | null = null
  private onChunk: ((chunk: Int8Array) => void) | null = null
  private paused = false
  private started = false

  constructor(streamId: string, dependencies?: Partial<TabAudioDependencies>) {
    this.streamId = streamId
    this.dependencies = { ...defaultDependencies(), ...dependencies }
  }

  async start(onChunk: (chunk: Int8Array) => void): Promise<void> {
    if (this.started) return
    this.onChunk = onChunk

    try {
      logSpeechDebug('标签页音频：请求权限')
      this.stream = await this.dependencies.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: this.streamId,
          },
        },
        video: false,
      } as MediaStreamConstraints)
      logSpeechDebug('标签页音频：权限已获取')
      this.context = this.dependencies.createAudioContext()
      if (!this.context.audioWorklet) {
        throw new Error('当前浏览器不支持 AudioWorklet')
      }

      this.workletUrl = this.dependencies.createObjectURL(
        new Blob([audioWorkletCode], { type: 'text/javascript' }),
      )
      await this.context.audioWorklet.addModule(this.workletUrl)
      logSpeechDebug('标签页音频：AudioWorklet 已加载', {
        sampleRate: this.context.sampleRate,
      })
      this.sourceNode = this.context.createMediaStreamSource(this.stream)
      this.workletNode = this.dependencies.createWorkletNode(this.context)
      this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!this.started || this.paused || !this.context) return
        const samples = downsampleTo16k(event.data, this.context.sampleRate)
        const pcm = float32ToPcm16(samples)
        for (const chunk of this.chunker.push(pcm)) {
          this.onChunk?.(chunk)
        }
      }
      this.sourceNode.connect(this.workletNode)
      this.sourceNode.connect(this.context.destination)
      this.workletNode.connect(this.context.destination)
      this.started = true
      logSpeechDebug('标签页音频：采集已启动')
    } catch (error) {
      logSpeechError('标签页音频启动失败', error)
      await this.cleanup()
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('标签页音频权限被拒绝，请重新授权标签页音频捕获', {
          cause: error,
        })
      }
      if (error instanceof Error) throw error
      throw new Error('无法启动标签页音频', { cause: error })
    }
  }

  async pause(): Promise<void> {
    if (!this.started || this.paused || !this.context) return
    this.paused = true
    await this.context.suspend()
    logSpeechDebug('标签页音频：已暂停')
  }

  async resume(): Promise<void> {
    if (!this.started || !this.paused || !this.context) return
    await this.context.resume()
    this.paused = false
    logSpeechDebug('标签页音频：已恢复')
  }

  async stop(): Promise<void> {
    await this.cleanup()
  }

  private async cleanup(): Promise<void> {
    const hadResources = Boolean(
      this.stream || this.context || this.workletNode,
    )
    if (this.workletNode) {
      this.workletNode.port.onmessage = null
      this.workletNode.disconnect()
    }
    this.sourceNode?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    if (this.context && this.context.state !== 'closed') {
      await this.context.close()
    }
    if (this.workletUrl) {
      this.dependencies.revokeObjectURL(this.workletUrl)
    }

    this.chunker.clear()
    this.stream = null
    this.context = null
    this.sourceNode = null
    this.workletNode = null
    this.workletUrl = null
    this.onChunk = null
    this.paused = false
    this.started = false
    if (hadResources) {
      logSpeechDebug('标签页音频：资源已释放')
    }
  }
}
