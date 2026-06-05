export type TranslationStatus =
  | 'idle'
  | 'requesting-permission'
  | 'connecting'
  | 'translating'
  | 'paused'
  | 'stopping'
  | 'error'

export interface TranslationSentence {
  id: string
  sourceText: string
  targetText: string
  startTime: number
  endTime: number
  isFinal: boolean
}

export interface SpeechTranslationSnapshot {
  status: TranslationStatus
  sentences: TranslationSentence[]
  error: string | null
}

export interface TencentSpeechConfig {
  appId: string
  secretId: string
  secretKey: string
  source: 'en'
  target: 'zh'
  voiceFormat: 1
  translationModel: 'hunyuan-translation-lite'
}
