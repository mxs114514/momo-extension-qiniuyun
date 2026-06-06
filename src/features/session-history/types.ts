import type { TranslationSentence } from '../speech-translation/types'

export interface TranslationHistorySession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  summary: string
  sentences: TranslationSentence[]
}

export interface TranslationHistorySummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  summary: string
  sentenceCount: number
}
