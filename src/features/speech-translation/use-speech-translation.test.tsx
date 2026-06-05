import { StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SpeechTranslationController } from './speech-translation-controller'
import { useSpeechTranslation } from './use-speech-translation'

describe('useSpeechTranslation', () => {
  it('StrictMode 模拟清理时不提前释放，真正卸载后释放', async () => {
    vi.useFakeTimers()
    const unsubscribe = vi.fn()
    const snapshot = {
      status: 'idle' as const,
      sentences: [],
      error: null,
    }
    const controller = {
      getSnapshot: vi.fn(() => snapshot),
      subscribe: vi.fn(() => unsubscribe),
      dispose: vi.fn().mockResolvedValue(undefined),
    } as unknown as SpeechTranslationController

    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    )
    const { result, unmount } = renderHook(
      () => useSpeechTranslation(controller),
      { wrapper },
    )
    expect(result.current.status).toBe('idle')
    expect(controller.subscribe).toHaveBeenCalled()
    expect(controller.dispose).not.toHaveBeenCalled()
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
    await act(() => vi.runAllTimersAsync())
    expect(controller.dispose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
