import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { SpeechTranslationPanelView } from '../features/speech-translation/SpeechTranslationPanel'
import { useExtensionSpeechTranslation } from './use-extension-speech-translation'

export function Popup() {
  const model = useExtensionSpeechTranslation()
  return (
    <div className="w-[360px] bg-slate-950">
      <SpeechTranslationPanelView model={model} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
)
