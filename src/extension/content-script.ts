type CaptionMessage =
  | {
      type: 'speech/snapshot'
      snapshot?: {
        status?: string
        error?: string | null
        sentences?: Array<{
          targetText?: string
        }>
      }
    }
  | {
      type: 'speech/stop'
    }

type RuntimeMessageApi = {
  runtime?: {
    onMessage?: {
      addListener?: (listener: (message: unknown) => void) => void
    }
  }
}

const OVERLAY_SELECTOR = '[data-momo-caption-overlay]'

let initialized = false

export function initializeContentScriptOverlay(): void {
  if (initialized) {
    return
  }

  initialized = true
  getChromeRuntime()?.onMessage?.addListener?.(handleMessage)
}

function handleMessage(message: unknown): void {
  if (!isCaptionMessage(message)) {
    return
  }

  if (message.type === 'speech/stop' || shouldClear(message)) {
    removeOverlay()
    return
  }

  const text = getLatestCaptionText(message)

  if (!text) {
    removeOverlay()
    return
  }

  getOrCreateOverlay().textContent = text
}

function shouldClear(
  message: Extract<CaptionMessage, { type: 'speech/snapshot' }>,
) {
  return (
    message.snapshot?.status === 'idle' ||
    message.snapshot?.status === 'stopping' ||
    message.snapshot?.status === 'error' ||
    Boolean(message.snapshot?.error)
  )
}

function getLatestCaptionText(
  message: Extract<CaptionMessage, { type: 'speech/snapshot' }>,
): string {
  return (
    message.snapshot?.sentences
      ?.map((sentence) => sentence.targetText?.trim() ?? '')
      .filter(Boolean)
      .at(-1) ?? ''
  )
}

function getOrCreateOverlay(): HTMLElement {
  const current = document.querySelector<HTMLElement>(OVERLAY_SELECTOR)

  if (current) {
    return current
  }

  const overlay = document.createElement('div')
  overlay.dataset.momoCaptionOverlay = 'true'
  Object.assign(overlay.style, {
    position: 'fixed',
    left: '50%',
    bottom: '8%',
    zIndex: '2147483647',
    maxWidth: '80vw',
    transform: 'translateX(-50%)',
    padding: '10px 16px',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.78)',
    color: '#fff',
    fontSize: '20px',
    lineHeight: '1.5',
    textAlign: 'center',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
  })
  document.body.append(overlay)

  return overlay
}

function removeOverlay(): void {
  document.querySelector(OVERLAY_SELECTOR)?.remove()
}

function isCaptionMessage(message: unknown): message is CaptionMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message.type === 'speech/snapshot' || message.type === 'speech/stop')
  )
}

function getChromeRuntime(): RuntimeMessageApi['runtime'] | undefined {
  return (globalThis as typeof globalThis & { chrome?: RuntimeMessageApi })
    .chrome?.runtime
}

initializeContentScriptOverlay()
