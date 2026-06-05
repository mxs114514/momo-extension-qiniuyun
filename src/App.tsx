import { useState } from 'react'
import { createSpeechTranslationController } from './features/speech-translation/create-speech-translation'
import { SpeechTranslationPanel } from './features/speech-translation/SpeechTranslationPanel'

function App() {
  const [controller] = useState(createSpeechTranslationController)
  return <SpeechTranslationPanel controller={controller} />
}

export default App
