import {
  type ExtensionCommand,
  type OffscreenCommand,
  type ExtensionEvent,
  isExtensionCommand,
  isExtensionEvent,
} from './messaging'
import type { SpeechTranslationSnapshot } from '../features/speech-translation/types'

type ChromeRuntimeSender = {
  tab?: {
    id?: number
  }
}

type SendResponse = (response: { ok: boolean; error?: string }) => void

type ChromeApi = {
  runtime: {
    onMessage: {
      addListener: (
        listener: (
          message: unknown,
          sender: ChromeRuntimeSender,
          sendResponse: SendResponse,
        ) => boolean | void,
      ) => void
    }
    sendMessage: (
      message: OffscreenCommand | ExtensionEvent,
    ) => Promise<unknown> | void
  }
  tabs: {
    query: (queryInfo: {
      active?: boolean
      currentWindow?: boolean
    }) => Promise<Array<{ id?: number }>>
    sendMessage: (
      tabId: number,
      message: ExtensionEvent,
    ) => Promise<unknown> | void
  }
  tabCapture: {
    getMediaStreamId: (options: { targetTabId: number }) => Promise<string>
  }
  offscreen: {
    hasDocument?: () => Promise<boolean>
    createDocument: (options: {
      url: string
      reasons: ['USER_MEDIA']
      justification: string
    }) => Promise<void>
  }
}

const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi })
  .chrome
let lastSnapshot: SpeechTranslationSnapshot | null = null

chromeApi?.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleRuntimeMessage(message, sender)
    .then(() => sendResponse({ ok: true }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : '扩展后台处理失败',
      }),
    )

  return true
})

async function handleRuntimeMessage(
  message: unknown,
  sender: ChromeRuntimeSender,
): Promise<void> {
  if (isExtensionEvent(message)) {
    await handleExtensionEvent(message)
    return
  }

  if (!isExtensionCommand(message)) {
    throw new Error('不支持的扩展消息')
  }

  switch (message.type) {
    case 'speech/start':
      await startTabAudio(message, sender)
      break
    case 'speech/pause':
      await sendOffscreenCommand({ type: 'offscreen/pause' })
      break
    case 'speech/resume':
      await sendOffscreenCommand({ type: 'offscreen/resume' })
      break
    case 'speech/stop':
      await sendOffscreenCommand({ type: 'offscreen/stop' })
      break
    case 'speech/get-snapshot':
      if (lastSnapshot) {
        await getChrome().runtime.sendMessage({
          type: 'speech/snapshot',
          snapshot: lastSnapshot,
        })
      }
      break
  }
}

async function handleExtensionEvent(event: ExtensionEvent): Promise<void> {
  if (event.type === 'speech/snapshot') {
    lastSnapshot = event.snapshot
  }
  await getChrome().runtime.sendMessage(event)
  await broadcastToContentScripts(event)
}

async function broadcastToContentScripts(event: ExtensionEvent): Promise<void> {
  const tabs = await getChrome().tabs.query({})
  await Promise.all(
    tabs
      .map((tab) => tab.id)
      .filter((tabId): tabId is number => typeof tabId === 'number')
      .map(async (tabId) => {
        try {
          await getChrome().tabs.sendMessage(tabId, event)
        } catch {
          // 没有注入内容脚本的页面会拒收消息，可以安全忽略。
        }
      }),
  )
}

async function startTabAudio(
  command: Extract<ExtensionCommand, { type: 'speech/start' }>,
  sender: ChromeRuntimeSender,
): Promise<void> {
  const targetTabId = await getTargetTabId(command.tabId, sender)
  await ensureOffscreenDocument()
  const streamId = await getChrome().tabCapture.getMediaStreamId({
    targetTabId,
  })
  await sendOffscreenCommand({
    type: 'offscreen/start-tab-audio',
    streamId,
  })
}

async function getTargetTabId(
  commandTabId: number,
  sender: ChromeRuntimeSender,
): Promise<number> {
  const [activeTab] = await getChrome().tabs.query({
    active: true,
    currentWindow: true,
  })
  const tabId = activeTab?.id ?? sender.tab?.id ?? commandTabId
  if (!tabId) throw new Error('未找到当前标签页')
  return tabId
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await getChrome().offscreen.hasDocument?.()) return

  await getChrome().offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Capture current tab audio and translate it in real time.',
  })
}

async function sendOffscreenCommand(command: OffscreenCommand): Promise<void> {
  await getChrome().runtime.sendMessage(command)
}

function getChrome(): ChromeApi {
  if (!chromeApi) throw new Error('当前环境不支持扩展 API')
  return chromeApi
}
