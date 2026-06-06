import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExtensionSessionHistory } from './use-extension-session-history'

const sendMessage = vi.fn()
type MessageListener = (message: unknown) => void
const listeners: MessageListener[] = []

beforeEach(() => {
  listeners.length = 0
  sendMessage.mockReset()
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
      onMessage: {
        addListener: (listener: MessageListener) => {
          listeners.push(listener)
        },
        removeListener: (listener: MessageListener) => {
          const index = listeners.indexOf(listener)
          if (index >= 0) listeners.splice(index, 1)
        },
      },
    },
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useExtensionSessionHistory', () => {
  it('挂载后加载历史列表并支持选择详情', async () => {
    sendMessage
      .mockResolvedValueOnce({
        ok: true,
        data: [
          {
            id: 's1',
            title: 'React Conf',
            createdAt: 1,
            updatedAt: 1,
            summary: '你好',
            sentenceCount: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 's1',
          title: 'React Conf',
          createdAt: 1,
          updatedAt: 1,
          summary: '你好',
          sentences: [],
        },
      })

    const { result } = renderHook(() => useExtensionSessionHistory())

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1)
    })

    await act(async () => {
      await result.current.selectSession('s1')
    })

    expect(sendMessage).toHaveBeenCalledWith({ type: 'history/list' })
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'history/get',
      sessionId: 's1',
    })
    expect(result.current.selectedSession?.title).toBe('React Conf')
  })

  it('改名和删除后刷新列表，删除后返回列表', async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, data: [] })

    const { result } = renderHook(() => useExtensionSessionHistory())
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'history/list' })
    })

    await act(async () => {
      await result.current.renameSession('s1', 'React 课程记录')
      await result.current.deleteSession('s1')
    })

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'history/rename',
      sessionId: 's1',
      title: 'React 课程记录',
    })
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'history/delete',
      sessionId: 's1',
    })
    expect(result.current.selectedSession).toBeNull()
  })

  it('收到历史记录变化事件后自动刷新列表', async () => {
    sendMessage
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({
        ok: true,
        data: [
          {
            id: 's2',
            title: '新保存记录',
            createdAt: 2,
            updatedAt: 2,
            summary: 'DeepSeek 生成摘要',
            sentenceCount: 2,
          },
        ],
      })

    const { result } = renderHook(() => useExtensionSessionHistory())

    await waitFor(() => {
      expect(result.current.sessions).toEqual([])
    })

    act(() => {
      listeners.at(-1)?.({ type: 'history/changed' })
    })

    await waitFor(() => {
      expect(result.current.sessions).toMatchObject([
        {
          title: '新保存记录',
          summary: 'DeepSeek 生成摘要',
        },
      ])
    })
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })
})
