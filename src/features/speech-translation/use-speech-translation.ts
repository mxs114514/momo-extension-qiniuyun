import { useEffect, useSyncExternalStore } from 'react'
import type { SpeechTranslationController } from './speech-translation-controller'

export function useSpeechTranslation(controller: SpeechTranslationController) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )

  useEffect(
    () => () => {
      void Promise.resolve(controller.dispose()).catch((error: unknown) => {
        console.error('释放实时翻译资源失败', error)
      })
    },
    [controller],
  )

  return snapshot
}
