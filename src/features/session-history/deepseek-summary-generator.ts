import type { TranslationSentence } from '../speech-translation/types'
import type { SummaryGenerator } from './summary-generator'

type Environment = Record<string, string | boolean | undefined>

export interface DeepSeekSummaryConfig {
  enabled: boolean
  apiKey: string
  model: string
}

interface DeepSeekSummaryGeneratorOptions {
  apiKey: string
  model: string
  endpoint?: string
  fetcher?: typeof fetch
}

const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash'
const DEEPSEEK_CHAT_COMPLETIONS_ENDPOINT =
  'https://api.deepseek.com/chat/completions'
const MAX_SUMMARY_SENTENCES = 20

export function parseDeepSeekSummaryConfig(
  environment: Environment,
): DeepSeekSummaryConfig {
  const apiKey = String(environment.VITE_DEEPSEEK_API_KEY ?? '').trim()
  const model =
    String(environment.VITE_DEEPSEEK_MODEL ?? '').trim() ||
    DEFAULT_DEEPSEEK_MODEL

  return {
    enabled: Boolean(apiKey),
    apiKey,
    model,
  }
}

export class DeepSeekSummaryGenerator implements SummaryGenerator {
  private readonly endpoint: string
  private readonly fetcher: typeof fetch
  private readonly options: DeepSeekSummaryGeneratorOptions

  constructor(options: DeepSeekSummaryGeneratorOptions) {
    this.options = options
    this.endpoint = options.endpoint ?? DEEPSEEK_CHAT_COMPLETIONS_ENDPOINT
    this.fetcher =
      options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
  }

  async generateSummary(sentences: TranslationSentence[]): Promise<string> {
    const content = sentences
      .map((sentence) => sentence.targetText.trim())
      .filter(Boolean)
      .slice(0, MAX_SUMMARY_SENTENCES)
      .join('\n')

    if (!content) return ''

    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: 120,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              '你是学习记录摘要助手。请用中文生成 1 句摘要，不超过 60 个汉字，不输出解释。',
          },
          {
            role: 'user',
            content,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error('DeepSeek 摘要生成失败')
    }

    const data: unknown = await response.json()
    const summary = getSummaryContent(data)
    if (!summary) {
      throw new Error('DeepSeek 返回摘要为空')
    }

    return summary
  }
}

function getSummaryContent(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.choices)) return ''

  const firstChoice = data.choices[0]
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return ''

  const content = firstChoice.message.content
  return typeof content === 'string' ? content.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
