export function downsampleTo16k(
  input: Float32Array,
  inputSampleRate: number,
): Float32Array {
  if (inputSampleRate < 16_000) {
    throw new Error('输入采样率不能低于 16000Hz')
  }
  if (inputSampleRate === 16_000 || input.length === 0) {
    return new Float32Array(input)
  }

  const outputLength = Math.round(input.length * (16_000 / inputSampleRate))
  const output = new Float32Array(outputLength)
  const ratio = inputSampleRate / 16_000
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(Math.floor((index + 1) * ratio), input.length)
    let sum = 0
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      sum += input[sourceIndex]
    }
    output[index] = sum / Math.max(1, end - start)
  }
  return output
}

export function float32ToPcm16(input: Float32Array): Int8Array {
  const buffer = new ArrayBuffer(input.length * 2)
  const view = new DataView(buffer)
  input.forEach((sample, index) => {
    const clipped = Math.max(-1, Math.min(1, sample))
    view.setInt16(
      index * 2,
      clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff,
      true,
    )
  })
  return new Int8Array(buffer)
}

export class PcmChunker {
  private buffer = new Uint8Array(0)
  private readonly chunkSize: number

  constructor(chunkSize = 6400) {
    this.chunkSize = chunkSize
  }

  push(chunk: Int8Array): Int8Array[] {
    const combined = new Uint8Array(this.buffer.length + chunk.byteLength)
    combined.set(this.buffer)
    combined.set(
      new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
      this.buffer.length,
    )

    const output: Int8Array[] = []
    let offset = 0
    while (combined.length - offset >= this.chunkSize) {
      output.push(
        new Int8Array(combined.slice(offset, offset + this.chunkSize)),
      )
      offset += this.chunkSize
    }
    this.buffer = combined.slice(offset)
    return output
  }

  flush(): Int8Array | null {
    if (this.buffer.length === 0) return null
    const remaining = new Int8Array(this.buffer)
    this.clear()
    return remaining
  }

  clear(): void {
    this.buffer = new Uint8Array(0)
  }
}
