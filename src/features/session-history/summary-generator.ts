import type { TranslationSentence } from '../speech-translation/types'

export interface SummaryGenerator {
  generateSummary(sentences: TranslationSentence[]): Promise<string>
}

const SUMMARY_LIMIT = 80

export class LocalSummaryGenerator implements SummaryGenerator {
  async generateSummary(sentences: TranslationSentence[]): Promise<string> {
    return createLocalSummary(sentences)
  }
}

export function createLocalSummary(sentences: TranslationSentence[]): string {
  return sentences[0]?.targetText.trim().slice(0, SUMMARY_LIMIT) ?? ''
}
