import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { TranslationSentence } from '../speech-translation/types'
import { SessionHistoryStore } from './history-store'

const stores: SessionHistoryStore[] = []

afterEach(async () => {
  await Promise.all(stores.map((store) => store.deleteDatabase()))
  stores.length = 0
})

describe('SessionHistoryStore', () => {
  it('保存有效会话后按创建时间倒序返回列表', async () => {
    const store = createStore()
    await store.saveSession({
      now: new Date('2026-06-06T18:42:00+08:00').getTime(),
      sentences: [makeSentence('1', 'hello', '你好，欢迎来到课程。')],
    })
    await store.saveSession({
      now: new Date('2026-06-06T19:15:00+08:00').getTime(),
      sentences: [makeSentence('2', 'rendering matters', '渲染体验很重要。')],
    })

    const sessions = await store.listSessions()

    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({
      title: '翻译记录 2026-06-06 19:15',
      summary: '渲染体验很重要。',
      sentenceCount: 1,
    })
    expect(sessions[1].title).toBe('翻译记录 2026-06-06 18:42')
  })

  it('不会保存空字幕或没有有效译文的会话', async () => {
    const store = createStore()

    await expect(
      store.saveSession({
        now: Date.now(),
        sentences: [],
      }),
    ).resolves.toBeNull()
    await expect(
      store.saveSession({
        now: Date.now(),
        sentences: [makeSentence('1', 'hello', '   ')],
      }),
    ).resolves.toBeNull()

    await expect(store.listSessions()).resolves.toEqual([])
  })

  it('改名后列表和详情都显示新标题', async () => {
    const store = createStore()
    const session = await store.saveSession({
      now: new Date('2026-06-06T18:42:00+08:00').getTime(),
      sentences: [makeSentence('1', 'hello', '你好')],
    })

    await store.renameSession(session!.id, 'React 课程记录')

    await expect(store.getSession(session!.id)).resolves.toMatchObject({
      title: 'React 课程记录',
    })
    await expect(store.listSessions()).resolves.toMatchObject([
      { title: 'React 课程记录' },
    ])
  })

  it('删除后列表和详情都不可再读取该记录', async () => {
    const store = createStore()
    const session = await store.saveSession({
      now: new Date('2026-06-06T18:42:00+08:00').getTime(),
      sentences: [makeSentence('1', 'hello', '你好')],
    })

    await store.deleteSession(session!.id)

    await expect(store.getSession(session!.id)).resolves.toBeNull()
    await expect(store.listSessions()).resolves.toEqual([])
  })
})

function createStore(): SessionHistoryStore {
  const store = new SessionHistoryStore({
    databaseName: `momo-history-test-${crypto.randomUUID()}`,
  })
  stores.push(store)
  return store
}

function makeSentence(
  id: string,
  sourceText: string,
  targetText: string,
): TranslationSentence {
  return {
    id,
    sourceText,
    targetText,
    startTime: 12,
    endTime: 18,
    isFinal: true,
  }
}
