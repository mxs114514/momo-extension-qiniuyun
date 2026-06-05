import { describe, expect, it } from 'vitest'
import { downsampleTo16k, float32ToPcm16, PcmChunker } from './pcm'

describe('PCM 工具', () => {
  it('将 Float32 样本裁剪并转换为 16bit 小端 PCM', () => {
    const result = float32ToPcm16(new Float32Array([-2, -1, 0, 1, 2]))
    expect(Array.from(new Uint8Array(result.buffer))).toEqual([
      0, 128, 0, 128, 0, 0, 255, 127, 255, 127,
    ])
  })

  it('将 48000Hz 输入降采样为 16000Hz', () => {
    const result = downsampleTo16k(new Float32Array(48_000), 48_000)
    expect(result).toHaveLength(16_000)
  })

  it('累计数据并只输出完整包', () => {
    const chunker = new PcmChunker(4)
    expect(chunker.push(new Int8Array([1, 2, 3]))).toEqual([])
    expect(chunker.push(new Int8Array([4, 5, 6, 7, 8]))).toEqual([
      new Int8Array([1, 2, 3, 4]),
      new Int8Array([5, 6, 7, 8]),
    ])
  })

  it('flush 返回剩余数据且清空缓冲区', () => {
    const chunker = new PcmChunker(4)
    chunker.push(new Int8Array([1, 2]))
    expect(chunker.flush()).toEqual(new Int8Array([1, 2]))
    expect(chunker.flush()).toBeNull()
  })
})
