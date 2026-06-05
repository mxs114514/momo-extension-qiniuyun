import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SpeechTranslationSnapshot } from '../features/speech-translation/types'
import { isExtensionEvent } from './messaging'

const idleSnapshot: SpeechTranslationSnapshot = {
  status: 'idle',
  sentences: [],
  error: null,
}

type ChromeApi = {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown> | void
    onMessage: {
      addListener: (listener: (message: unknown) => void) => void
      removeListener: (listener: (message: unknown) => void) => void
    }
  }
  tabs: {
    query: (queryInfo: {
      active: boolean
      currentWindow: boolean
    }) => Promise<Array<{ id?: number }>>
  }
}

export function useExtensionSpeechTranslation() {
  const [snapshot, setSnapshot] =
    useState<SpeechTranslationSnapshot>(idleSnapshot)

  useEffect(() => {
    const listener = (message: unknown) => {
      if (!isExtensionEvent(message)) return

      if (message.type === 'speech/snapshot') {
        setSnapshot(message.snapshot)
        return
      }

      setSnapshot((current) => ({
        ...current,
        status: 'error',
        error: message.message,
      }))
    }

    getChrome().runtime.onMessage.addListener(listener)
    void getChrome().runtime.sendMessage({ type: 'speech/get-snapshot' })

    return () => {
      getChrome().runtime.onMessage.removeListener(listener)
    }
  }, [])

  const start = useCallback(async () => {
    const [activeTab] = await getChrome().tabs.query({
      active: true,
      currentWindow: true,
    })
    if (!activeTab?.id) {
      setSnapshot((current) => ({
        ...current,
        status: 'error',
        error: '未找到当前标签页',
      }))
      return
    }

    await getChrome().runtime.sendMessage({
      type: 'speech/start',
      tabId: activeTab.id,
    })
  }, [])

  const pause = useCallback(async () => {
    await getChrome().runtime.sendMessage({ type: 'speech/pause' })
  }, [])
  const resume = useCallback(async () => {
    await getChrome().runtime.sendMessage({ type: 'speech/resume' })
  }, [])
  const stop = useCallback(async () => {
    await getChrome().runtime.sendMessage({ type: 'speech/stop' })
  }, [])

  return useMemo(
    () => ({ snapshot, start, pause, resume, stop }),
    [pause, resume, snapshot, start, stop],
  )
}

function getChrome(): ChromeApi {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi })
    .chrome
  if (!chromeApi) throw new Error('当前环境不支持扩展 API')
  return chromeApi
}
