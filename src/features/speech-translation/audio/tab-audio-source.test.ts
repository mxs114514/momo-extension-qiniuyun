import { describe, expect, it, vi } from 'vitest'
import { TabAudioSource } from './tab-audio-source'

function setup(streamId = 'tab-stream-id') {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  const sourceNode = { connect: vi.fn(), disconnect: vi.fn() }
  const workletNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    port: {
      onmessage: null as ((event: MessageEvent<Float32Array>) => void) | null,
    },
  }
  const context = {
    sampleRate: 48_000,
    destination: {},
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    createMediaStreamSource: vi.fn(() => sourceNode),
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  const createObjectURL = vi.fn(() => 'blob:worklet')
  const getWorkletModuleUrl = vi.fn<() => string | null>(() => null)
  const revokeObjectURL = vi.fn()
  const audioSource = new TabAudioSource(streamId, {
    getUserMedia,
    createAudioContext: () => context as unknown as AudioContext,
    createWorkletNode: () => workletNode as unknown as AudioWorkletNode,
    createObjectURL,
    getWorkletModuleUrl,
    revokeObjectURL,
  })
  return {
    audioSource,
    context,
    createObjectURL,
    getUserMedia,
    getWorkletModuleUrl,
    revokeObjectURL,
    sourceNode,
    track,
    workletNode,
  }
}

describe('TabAudioSource', () => {
  it('采集标签页音频、回放到当前标签页、分包并支持暂停恢复和幂等停止', async () => {
    const fixture = setup('tab-123')
    const onChunk = vi.fn()
    await fixture.audioSource.start(onChunk)

    expect(fixture.getUserMedia).toHaveBeenCalledWith({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: 'tab-123',
        },
      },
      video: false,
    })
    expect(fixture.context.audioWorklet.addModule).toHaveBeenCalledWith(
      'blob:worklet',
    )
    expect(fixture.sourceNode.connect).toHaveBeenCalledWith(
      fixture.context.destination,
    )
    expect(fixture.sourceNode.connect).toHaveBeenCalledWith(fixture.workletNode)
    expect(fixture.workletNode.connect).toHaveBeenCalledWith(
      fixture.context.destination,
    )

    fixture.workletNode.port.onmessage?.(
      new MessageEvent('message', { data: new Float32Array(9_600) }),
    )
    expect(onChunk).toHaveBeenCalledWith(expect.any(Int8Array))
    expect(onChunk.mock.calls[0][0]).toHaveLength(6400)

    await fixture.audioSource.pause()
    fixture.workletNode.port.onmessage?.(
      new MessageEvent('message', { data: new Float32Array(9_600) }),
    )
    expect(onChunk).toHaveBeenCalledTimes(1)
    expect(fixture.context.suspend).toHaveBeenCalledOnce()
    expect(fixture.track.stop).not.toHaveBeenCalled()

    await fixture.audioSource.resume()
    expect(fixture.context.resume).toHaveBeenCalledOnce()

    await fixture.audioSource.stop()
    await fixture.audioSource.stop()
    expect(fixture.sourceNode.disconnect).toHaveBeenCalledOnce()
    expect(fixture.workletNode.disconnect).toHaveBeenCalledOnce()
    expect(fixture.track.stop).toHaveBeenCalledOnce()
    expect(fixture.context.close).toHaveBeenCalledOnce()
    expect(fixture.revokeObjectURL).toHaveBeenCalledWith('blob:worklet')
  })

  it('插件环境使用静态 AudioWorklet 文件，避免 CSP 阻止 blob 脚本', async () => {
    const fixture = setup()
    fixture.getWorkletModuleUrl.mockReturnValueOnce(
      'chrome-extension://extension-id/speech-pcm-worklet.js',
    )

    await fixture.audioSource.start(vi.fn())

    expect(fixture.context.audioWorklet.addModule).toHaveBeenCalledWith(
      'chrome-extension://extension-id/speech-pcm-worklet.js',
    )
    expect(fixture.createObjectURL).not.toHaveBeenCalled()
  })

  it('将标签页音频权限拒绝转换为中文错误', async () => {
    const fixture = setup()
    fixture.getUserMedia.mockRejectedValueOnce(
      new DOMException('denied', 'NotAllowedError'),
    )
    await expect(fixture.audioSource.start(vi.fn())).rejects.toThrow(
      '标签页音频权限被拒绝，请重新点击开始并在授权弹窗中允许捕获当前标签页声音。',
    )
  })

  it('将未知标签页音频启动错误转换为带操作指引的中文错误', async () => {
    const fixture = setup()
    fixture.getUserMedia.mockRejectedValueOnce(
      new Error('Failed to execute getUserMedia'),
    )

    await expect(fixture.audioSource.start(vi.fn())).rejects.toThrow(
      '无法启动标签页音频，请刷新页面并重新加载扩展后重试。',
    )
  })

  it('不支持 AudioWorklet 时明确失败并清理已获取的标签页音频', async () => {
    const fixture = setup()
    const context = fixture.context as {
      audioWorklet?: { addModule: ReturnType<typeof vi.fn> }
    }
    delete context.audioWorklet
    await expect(fixture.audioSource.start(vi.fn())).rejects.toThrow(
      '当前浏览器不支持音频处理能力，请升级 Chrome 或 Edge 后重试。',
    )
    expect(fixture.track.stop).toHaveBeenCalledOnce()
  })

  it('将 AudioWorklet 加载失败转换为中文错误', async () => {
    const fixture = setup()
    fixture.context.audioWorklet.addModule.mockRejectedValueOnce(
      new DOMException("Unable to load a worklet's module.", 'AbortError'),
    )

    await expect(fixture.audioSource.start(vi.fn())).rejects.toThrow(
      '无法加载标签页音频处理模块，请刷新页面并重新加载扩展后重试。',
    )
    expect(fixture.track.stop).toHaveBeenCalledOnce()
  })
})
