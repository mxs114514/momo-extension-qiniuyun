import { MicrophoneAudioSource } from './audio/microphone-audio-source'
import { TabAudioSource } from './audio/tab-audio-source'
import type { AudioSource } from './audio/audio-source'
import { TencentSpeechTranslateClient } from './client/tencent-speech-translate-client'
import { parseTencentSpeechConfig } from './config'
import { logSpeechDebug } from './debug'
import { SpeechTranslationController } from './speech-translation-controller'
import { TranscriptStore } from './transcript-store'

export function createSpeechTranslationController(): SpeechTranslationController {
  return createSpeechTranslationControllerWithAudioSource(
    new MicrophoneAudioSource(),
  )
}

export function createTabSpeechTranslationController(
  streamId: string,
): SpeechTranslationController {
  return createSpeechTranslationControllerWithAudioSource(
    new TabAudioSource(streamId),
  )
}

function createSpeechTranslationControllerWithAudioSource(
  audioSource: AudioSource,
): SpeechTranslationController {
  return new SpeechTranslationController({
    audioSource,
    transcriptStore: new TranscriptStore(),
    createClient: (events) => {
      logSpeechDebug('配置检查', {
        appId: Boolean(import.meta.env.VITE_TENCENT_APP_ID),
        secretId: Boolean(import.meta.env.VITE_TENCENT_SECRET_ID),
        secretKey: Boolean(import.meta.env.VITE_TENCENT_SECRET_KEY),
        production: import.meta.env.PROD,
      })
      return new TencentSpeechTranslateClient(
        parseTencentSpeechConfig(import.meta.env),
        events,
      )
    },
  })
}
