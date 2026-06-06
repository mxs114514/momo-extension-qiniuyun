import { useState } from 'react'
import type {
  TranslationHistorySession,
  TranslationHistorySummary,
} from './types'

export interface SessionHistoryPanelModel {
  sessions: TranslationHistorySummary[]
  selectedSession: TranslationHistorySession | null
  selectSession: (id: string) => void | Promise<void>
  backToList: () => void
  renameSession: (id: string, title: string) => void | Promise<void>
  deleteSession: (id: string) => void | Promise<void>
  exportSession: (id: string) => void | Promise<void>
  error: string | null
}

export function SessionHistoryPanelView({
  model,
}: {
  model: SessionHistoryPanelModel
}) {
  if (model.selectedSession) {
    return (
      <SessionDetail
        key={model.selectedSession.id}
        model={model}
        session={model.selectedSession}
      />
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-5 py-7 sm:px-8">
      <header className="border-b border-slate-800 pb-5">
        <p className="mb-2 text-xs font-semibold tracking-[0.24em] text-sky-400 uppercase">
          Momo Study
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          学习记录
        </h1>
      </header>

      {model.error && (
        <p role="alert" className="mt-5 text-sm text-red-300">
          {model.error}
        </p>
      )}

      <section className="flex-1 py-5">
        {model.sessions.length === 0 ? (
          <p className="mt-14 text-lg leading-8 text-slate-500">
            暂无学习记录。停止翻译时选择保存后，会显示在这里。
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {model.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => void model.selectSession(session.id)}
                className="block w-full py-5 text-left transition hover:bg-slate-900/40"
              >
                <div className="flex items-start justify-between gap-4 text-sm text-slate-400">
                  <span>{formatDateTime(session.createdAt)}</span>
                  <span>{session.sentenceCount} 句</span>
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {session.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                  {session.summary || '暂无摘要'}
                </p>
                <SummaryWarning message={session.summaryWarning} />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function SessionDetail({
  model,
  session,
}: {
  model: SessionHistoryPanelModel
  session: TranslationHistorySession
}) {
  const [title, setTitle] = useState(session.title)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-5 py-7 sm:px-8">
      <header className="border-b border-slate-800 pb-5">
        <button
          type="button"
          onClick={model.backToList}
          className="mb-5 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          返回列表
        </button>
        <label className="block text-sm font-medium text-slate-300">
          记录名称
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xl font-semibold text-white transition outline-none focus:border-sky-400"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void model.renameSession(session.id, title)}
            className="rounded-md bg-sky-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            保存名称
          </button>
          <button
            type="button"
            onClick={() => void model.exportSession(session.id)}
            className="rounded-md border border-slate-600 px-4 py-2 font-semibold text-slate-100 transition hover:border-sky-400"
          >
            导出 Markdown
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('删除后无法恢复，确定删除这条学习记录吗？')) {
                void model.deleteSession(session.id)
              }
            }}
            className="rounded-md border border-red-800 px-4 py-2 font-semibold text-red-300 transition hover:border-red-500"
          >
            删除记录
          </button>
        </div>
      </header>

      <section className="space-y-5 py-6">
        <div className="text-sm leading-6 text-slate-400">
          <p>创建时间：{formatDateTime(session.createdAt)}</p>
          <p>更新时间：{formatDateTime(session.updatedAt)}</p>
          <p>字幕数量：{session.sentences.length}</p>
        </div>
        <div className="border-y border-slate-800 py-5 text-sky-100">
          {session.summary || '暂无摘要'}
          <SummaryWarning message={session.summaryWarning} />
        </div>
        <div className="space-y-6">
          {session.sentences.map((sentence) => (
            <article key={sentence.id}>
              <p className="text-xs font-medium text-slate-500">
                {formatTime(sentence.startTime)} -{' '}
                {formatTime(sentence.endTime)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {sentence.sourceText}
              </p>
              <p className="mt-1 text-lg leading-8 text-slate-100">
                {sentence.targetText}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function SummaryWarning({ message }: { message?: string }) {
  if (!message) return null

  return (
    <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-200">
      {message}
    </p>
  )
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const restSeconds = totalSeconds % 60
  return `${pad(minutes)}:${pad(restSeconds)}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
