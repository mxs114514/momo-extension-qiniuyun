import { describe, expect, it } from 'vitest'
import { TranscriptStore } from './transcript-store'

describe('TranscriptStore', () => {
  it('按 sentence_id 覆盖当前句并保留双语文本', () => {
    const store = new TranscriptStore()

    store.update({
      sentenceId: '1',
      sourceText: 'Welcome',
      targetText: '欢迎',
      startTime: 0,
      endTime: 200,
      sentenceEnd: false,
    })
    store.update({
      sentenceId: '1',
      sourceText: 'Welcome everyone',
      targetText: '欢迎大家',
      startTime: 0,
      endTime: 500,
      sentenceEnd: true,
    })

    expect(store.getSentences()).toEqual([
      {
        id: '1',
        sourceText: 'Welcome everyone',
        targetText: '欢迎大家',
        startTime: 0,
        endTime: 500,
        isFinal: true,
      },
    ])
  })

  it('保持句子首次出现的顺序', () => {
    const store = new TranscriptStore()

    store.update({
      sentenceId: '2',
      sourceText: 'Second',
      targetText: '第二句',
      startTime: 200,
      endTime: 400,
      sentenceEnd: false,
    })
    store.update({
      sentenceId: '1',
      sourceText: 'First',
      targetText: '第一句',
      startTime: 0,
      endTime: 200,
      sentenceEnd: true,
    })
    store.update({
      sentenceId: '2',
      sourceText: 'Second updated',
      targetText: '第二句更新',
      startTime: 200,
      endTime: 500,
      sentenceEnd: true,
    })

    expect(store.getSentences().map((sentence) => sentence.id)).toEqual([
      '2',
      '1',
    ])
  })

  it('返回副本并支持清空', () => {
    const store = new TranscriptStore()
    store.update({
      sentenceId: '1',
      sourceText: 'Hello',
      targetText: '你好',
      startTime: 0,
      endTime: 100,
      sentenceEnd: true,
    })

    const sentences = store.getSentences()
    sentences[0].targetText = '已修改'

    expect(store.getSentences()[0].targetText).toBe('你好')
    store.clear()
    expect(store.getSentences()).toEqual([])
  })
})
