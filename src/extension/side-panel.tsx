import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { SpeechTranslationPanelView } from '../features/speech-translation/SpeechTranslationPanel'
import { useExtensionSpeechTranslation } from './use-extension-speech-translation'

export function SidePanel() {
  const model = useExtensionSpeechTranslation()
  return <SpeechTranslationPanelView model={model} />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
)
