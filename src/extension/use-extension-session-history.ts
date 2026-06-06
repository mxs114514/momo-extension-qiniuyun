import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildMarkdownExport,
  createMarkdownFileName,
} from '../features/session-history/export-session'
import type {
  TranslationHistorySession,
  TranslationHistorySummary,
} from '../features/session-history/types'

type ChromeApi = {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>
    onMessage: {
      addListener: (listener: (message: unknown) => void) => void
      removeListener: (listener: (message: unknown) => void) => void
    }
  }
}

type ExtensionResponse<T> =
  | { ok: true; data?: T }
  | { ok: false; error?: string }

export function useExtensionSessionHistory() {
  const [sessions, setSessions] = useState<TranslationHistorySummary[]>([])
  const [selectedSession, setSelectedSession] =
    useState<TranslationHistorySession | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sendCommand = useCallback(async <T>(message: unknown): Promise<T> => {
    const response = (await getChrome().runtime.sendMessage(
      message,
    )) as ExtensionResponse<T>
    if (!response?.ok) {
      throw new Error(response?.error ?? '历史记录操作失败')
    }
    return response.data as T
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      setError(null)
      setSessions(
        await sendCommand<TranslationHistorySummary[]>({
          type: 'history/list',
        }),
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : '加载历史记录失败')
    }
  }, [sendCommand])

  useEffect(() => {
    queueMicrotask(() => {
      void loadSessions()
    })
  }, [loadSessions])

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      if (!isHistoryChangedEvent(message)) return

      void loadSessions()
      if (selectedSession) {
        void sendCommand<TranslationHistorySession | null>({
          type: 'history/get',
          sessionId: selectedSession.id,
        })
          .then(setSelectedSession)
          .catch((error) => {
            setError(
              error instanceof Error ? error.message : '加载记录详情失败',
            )
          })
      }
    }

    getChrome().runtime.onMessage.addListener(handleMessage)
    return () => {
      getChrome().runtime.onMessage.removeListener(handleMessage)
    }
  }, [loadSessions, selectedSession, sendCommand])

  const selectSession = useCallback(
    async (sessionId: string) => {
      try {
        setError(null)
        setSelectedSession(
          await sendCommand<TranslationHistorySession | null>({
            type: 'history/get',
            sessionId,
          }),
        )
      } catch (error) {
        setError(error instanceof Error ? error.message : '加载记录详情失败')
      }
    },
    [sendCommand],
  )

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      try {
        setError(null)
        await sendCommand<void>({
          type: 'history/rename',
          sessionId,
          title,
        })
        await loadSessions()
        await selectSession(sessionId)
      } catch (error) {
        setError(error instanceof Error ? error.message : '修改记录名称失败')
      }
    },
    [loadSessions, selectSession, sendCommand],
  )

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        setError(null)
        await sendCommand<void>({
          type: 'history/delete',
          sessionId,
        })
        setSelectedSession(null)
        await loadSessions()
      } catch (error) {
        setError(error instanceof Error ? error.message : '删除历史记录失败')
      }
    },
    [loadSessions, sendCommand],
  )

  const exportSession = useCallback(
    async (sessionId: string) => {
      try {
        setError(null)
        const session = await sendCommand<TranslationHistorySession | null>({
          type: 'history/get',
          sessionId,
        })
        if (!session) throw new Error('历史记录不存在')
        downloadMarkdown(session)
      } catch (error) {
        setError(error instanceof Error ? error.message : '导出历史记录失败')
      }
    },
    [sendCommand],
  )

  return useMemo(
    () => ({
      sessions,
      selectedSession,
      error,
      selectSession,
      backToList: () => setSelectedSession(null),
      renameSession,
      deleteSession,
      exportSession,
    }),
    [
      deleteSession,
      error,
      exportSession,
      renameSession,
      selectSession,
      selectedSession,
      sessions,
    ],
  )
}

function downloadMarkdown(session: TranslationHistorySession): void {
  const blob = new Blob([buildMarkdownExport(session)], {
    type: 'text/markdown;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = createMarkdownFileName(session)
  link.click()
  URL.revokeObjectURL(url)
}

function getChrome(): ChromeApi {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi })
    .chrome
  if (!chromeApi) throw new Error('当前环境不支持扩展 API')
  return chromeApi
}

function isHistoryChangedEvent(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'history/changed'
  )
}
