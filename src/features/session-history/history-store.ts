import Dexie, { type EntityTable } from 'dexie'
import type { TranslationSentence } from '../speech-translation/types'
import type {
  TranslationHistorySession,
  TranslationHistorySummary,
} from './types'
import {
  createLocalSummary,
  LocalSummaryGenerator,
  type SummaryGenerator,
} from './summary-generator'

interface SessionHistoryStoreOptions {
  databaseName?: string
  summaryGenerator?: SummaryGenerator
}

interface SaveSessionInput {
  now: number
  sentences: TranslationSentence[]
}

type SessionHistoryDatabase = Dexie & {
  sessions: EntityTable<TranslationHistorySession, 'id'>
}

interface SummaryResult {
  text: string
  warning?: string
}

const DEFAULT_DATABASE_NAME = 'momo-session-history'

export class SessionHistoryStore {
  private readonly db: SessionHistoryDatabase
  private readonly summaryGenerator: SummaryGenerator

  constructor(options: SessionHistoryStoreOptions = {}) {
    this.db = new Dexie(
      options.databaseName ?? DEFAULT_DATABASE_NAME,
    ) as SessionHistoryDatabase
    this.db.version(1).stores({
      sessions: 'id, createdAt, updatedAt',
    })
    this.summaryGenerator =
      options.summaryGenerator ?? new LocalSummaryGenerator()
  }

  async saveSession(
    input: SaveSessionInput,
  ): Promise<TranslationHistorySession | null> {
    const sentences = input.sentences
      .filter(hasText)
      .map((sentence) => ({ ...sentence }))
    if (sentences.length === 0) return null

    const summary = await this.createSummary(sentences)
    const session: TranslationHistorySession = {
      id: crypto.randomUUID(),
      title: `翻译记录 ${formatDateTime(input.now)}`,
      createdAt: input.now,
      updatedAt: input.now,
      summary: summary.text,
      summaryWarning: summary.warning,
      sentences,
    }

    await this.db.sessions.put(session)
    return {
      ...session,
      sentences: session.sentences.map((item) => ({ ...item })),
    }
  }

  async listSessions(): Promise<TranslationHistorySummary[]> {
    const sessions = await this.db.sessions
      .orderBy('createdAt')
      .reverse()
      .toArray()
    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      summary: session.summary,
      summaryWarning: session.summaryWarning,
      sentenceCount: session.sentences.length,
    }))
  }

  async getSession(id: string): Promise<TranslationHistorySession | null> {
    const session = await this.db.sessions.get(id)
    return session
      ? {
          ...session,
          sentences: session.sentences.map((item) => ({ ...item })),
        }
      : null
  }

  async renameSession(id: string, title: string): Promise<void> {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) return

    await this.db.sessions.update(id, {
      title: normalizedTitle,
      updatedAt: Date.now(),
    })
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.sessions.delete(id)
  }

  async deleteDatabase(): Promise<void> {
    this.db.close()
    await Dexie.delete(this.db.name)
  }

  private async createSummary(
    sentences: TranslationSentence[],
  ): Promise<SummaryResult> {
    try {
      const summary = await this.summaryGenerator.generateSummary(sentences)
      if (summary.trim()) return { text: summary.trim() }
    } catch (error) {
      console.warn('DeepSeek 摘要生成失败，已回退到本地摘要', error)
      return {
        text: createLocalSummary(sentences),
        warning: `AI 摘要失败，已使用本地摘要：${getErrorMessage(error)}`,
      }
    }

    return { text: createLocalSummary(sentences) }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}

function hasText(sentence: TranslationSentence): boolean {
  return Boolean(sentence.targetText.trim())
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
