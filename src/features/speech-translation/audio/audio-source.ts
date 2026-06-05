export interface AudioSource {
  start(onChunk: (chunk: Int8Array) => void): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<void>
}
