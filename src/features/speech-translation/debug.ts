const PREFIX = '[实时翻译]'

export function logSpeechDebug(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.info(PREFIX, message)
    return
  }
  console.info(PREFIX, message, detail)
}

export function logSpeechError(message: string, error?: unknown): void {
  if (error === undefined) {
    console.error(PREFIX, message)
    return
  }
  console.error(PREFIX, message, error)
}
