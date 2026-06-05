import type { TranslationSentence } from './types'

export interface TranslationUpdate {
  sentenceId: string
  sourceText: string
  targetText: string
  startTime: number
  endTime: number
  sentenceEnd: boolean
}

export class TranscriptStore {
  private readonly sentences = new Map<string, TranslationSentence>()
  private readonly order: string[] = []

  update(update: TranslationUpdate): void {
    if (!this.sentences.has(update.sentenceId)) {
      this.order.push(update.sentenceId)
    }

    this.sentences.set(update.sentenceId, {
      id: update.sentenceId,
      sourceText: update.sourceText,
      targetText: update.targetText,
      startTime: update.startTime,
      endTime: update.endTime,
      isFinal: update.sentenceEnd,
    })
  }

  clear(): void {
    this.sentences.clear()
    this.order.length = 0
  }

  getSentences(): TranslationSentence[] {
    return this.order.flatMap((id) => {
      const sentence = this.sentences.get(id)
      return sentence ? [{ ...sentence }] : []
    })
  }
}
