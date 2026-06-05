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
  const revokeObjectURL = vi.fn()
  const audioSource = new TabAudioSource(streamId, {
    getUserMedia,
    createAudioContext: () => context as unknown as AudioContext,
    createWorkletNode: () => workletNode as unknown as AudioWorkletNode,
    createObjectURL: () => 'blob:worklet',
    revokeObjectURL,
  })
  return {
    audioSource,
    context,
    getUserMedia,
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

  it('将标签页音频权限拒绝转换为中文错误', async () => {
    const fixture = setup()
    fixture.getUserMedia.mockRejectedValueOnce(
      new DOMException('denied', 'NotAllowedError'),
    )
    await expect(fixture.audioSource.start(vi.fn())).rejects.toThrow(
      '标签页音频权限被拒绝，请重新授权标签页音频捕获',
    )
  })

  it('不支持 AudioWorklet 时明确失败并清理已获取的标签页音频', async () => {
    const fixture = setup()
    const context = fixture.context as {
      audioWorklet?: { addModule: ReturnType<typeof vi.fn> }
    }
    delete context.audioWorklet
    await expect(fixture.audioSource.start(vi.fn())).rejects.toThrow(
      '当前浏览器不支持 AudioWorklet',
    )
    expect(fixture.track.stop).toHaveBeenCalledOnce()
  })
})
