/**
 * 注入到目标网页的内容脚本 (Content Script)。
 * 负责在目标网页中渲染“悬浮翻译气泡”和“底部实时字幕面板”，
 * 并监听来自 background script 的状态更新，以保持网页字幕与后台音频翻译状态同步。
 */
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
  | {
      type: 'ui/open-panel'
    }

type RuntimeMessageApi = {
  runtime?: {
    sendMessage?: (message: unknown) => Promise<unknown> | void
    onMessage?: {
      addListener?: (listener: (message: unknown) => void) => void
    }
  }
}

const OVERLAY_SELECTOR = '[data-momo-caption-overlay]'
const BUBBLE_SELECTOR = '[data-momo-caption-bubble]'
const PANEL_SELECTOR = '[data-momo-caption-panel]'

let initialized = false
let captionText = ''
let status = 'idle'
let errorText = ''
let viewMode: 'bubble' | 'panel' = 'bubble'

const statusLabels: Record<string, string> = {
  idle: '等待开始',
  'requesting-permission': '请求麦克风权限',
  connecting: '连接腾讯云',
  translating: '翻译中',
  paused: '已暂停',
  stopping: '正在停止',
  error: '发生异常',
}

export function initializeContentScriptOverlay(): void {
  if (initialized) {
    return
  }

  initialized = true
  renderBubble()
  getChromeRuntime()?.onMessage?.addListener?.(handleMessage)
}

function handleMessage(message: unknown): void {
  if (!isCaptionMessage(message)) {
    return
  }

  if (message.type === 'ui/open-panel') {
    viewMode = 'panel'
    renderPanel()
    return
  }

  if (message.type === 'speech/stop' || shouldClearCaption(message)) {
    captionText = ''
    errorText = ''
    status = 'idle'
    viewMode = 'bubble'
    renderBubble()
    return
  }

  const text = getLatestCaptionText(message)
  captionText = text
  status = message.snapshot?.status ?? status
  errorText = message.snapshot?.error ?? ''

  if (hasSnapshotError(message)) {
    status = 'error'
    errorText = message.snapshot?.error ?? '翻译异常'
  }

  if (viewMode === 'panel') {
    renderPanel()
    return
  }

  renderBubble()
}

function shouldClearCaption(
  message: Extract<CaptionMessage, { type: 'speech/snapshot' }>,
) {
  return (
    message.snapshot?.status === 'idle' ||
    message.snapshot?.status === 'stopping'
  )
}

function hasSnapshotError(
  message: Extract<CaptionMessage, { type: 'speech/snapshot' }>,
): boolean {
  return (
    message.snapshot?.status === 'error' || Boolean(message.snapshot?.error)
  )
}

function getLatestCaptionText(
  message: Extract<CaptionMessage, { type: 'speech/snapshot' }>,
): string {
  return (
    message.snapshot?.sentences
      ?.map((sentence) => sentence.targetText?.trim() ?? '')
      .filter(Boolean)
      .slice(-2)
      .join('\n') ?? ''
  )
}

function renderBubble(): void {
  removeOverlay()

  if (document.querySelector(BUBBLE_SELECTOR)) {
    return
  }

  const bubble = document.createElement('button')
  bubble.type = 'button'
  bubble.dataset.momoCaptionBubble = 'true'
  bubble.setAttribute('aria-label', '展开实时字幕')
  bubble.textContent = '译'
  Object.assign(bubble.style, {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    zIndex: '2147483647',
    width: '48px',
    height: '48px',
    border: '0',
    borderRadius: '999px',
    background: 'rgba(17, 24, 39, 0.92)',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '700',
    lineHeight: '48px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.28)',
    cursor: 'pointer',
  })
  bubble.addEventListener('click', () => {
    viewMode = 'panel'
    renderPanel()
  })
  document.body.append(bubble)
}

function renderPanel(): void {
  removeBubble()
  removeOverlay()

  const panel = document.createElement('div')
  panel.dataset.momoCaptionPanel = 'true'
  Object.assign(panel.style, {
    position: 'fixed',
    left: '50%',
    bottom: '8%',
    zIndex: '2147483647',
    width: '1620px',
    height: '200px',
    maxWidth: 'calc(100vw - 32px)',
    boxSizing: 'border-box',
    transform: 'translateX(-50%)',
    padding: '10px 48px 10px 16px',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.78)',
    color: '#fff',
    fontSize: '20px',
    lineHeight: '1.5',
    textAlign: 'center',
    pointerEvents: 'auto',
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.22)',
    display: 'flex',
    flexDirection: 'column',
  })

  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '8px',
    paddingRight: '24px',
    color: '#cbd5e1',
    fontSize: '16px',
    lineHeight: '1.4',
  })

  const title = document.createElement('strong')
  title.textContent = '莫莫实时字幕'
  Object.assign(title.style, {
    color: '#fff',
    fontSize: '18px',
  })

  const statusNode = document.createElement('span')
  statusNode.textContent = statusLabels[status] ?? status
  header.append(title, statusNode)

  const overlay = document.createElement('span')
  overlay.dataset.momoCaptionOverlay = 'true'
  overlay.setAttribute('role', 'status')
  overlay.textContent = captionText || '等待字幕...'
  Object.assign(overlay.style, {
    display: 'block',
    minHeight: '72px',
    maxHeight: '96px',
    overflow: 'hidden',
  })

  const errorNode = document.createElement('div')
  errorNode.textContent = errorText
  Object.assign(errorNode.style, {
    display: errorText ? 'block' : 'none',
    marginTop: '8px',
    color: '#fecaca',
    fontSize: '13px',
    lineHeight: '1.5',
  })

  const controls = document.createElement('div')
  Object.assign(controls.style, {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: 'auto',
    marginBottom: '8px',
  })
  controls.append(...createControlButtons())

  const minimizeButton = document.createElement('button')
  minimizeButton.type = 'button'
  minimizeButton.dataset.momoCaptionMinimize = 'true'
  minimizeButton.setAttribute('aria-label', '收起实时字幕')
  minimizeButton.textContent = '-'
  Object.assign(minimizeButton.style, {
    position: 'absolute',
    top: '8px',
    right: '10px',
    width: '24px',
    height: '24px',
    border: '0',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.14)',
    color: '#fff',
    fontSize: '18px',
    lineHeight: '20px',
    cursor: 'pointer',
  })
  minimizeButton.addEventListener('click', (event) => {
    event.stopPropagation()
    viewMode = 'bubble'
    renderBubble()
  })
  panel.append(header, overlay, errorNode, controls, minimizeButton)
  document.body.append(panel)
}

function createControlButtons(): HTMLButtonElement[] {
  if (status === 'idle' || status === 'error') {
    return [
      createCommandButton(status === 'error' ? '重新开始' : '开始翻译', {
        type: 'speech/start',
      }),
    ]
  }

  if (status === 'translating') {
    return [
      createCommandButton('暂停', { type: 'speech/pause' }),
      createCommandButton('停止', { type: 'speech/stop' }, true),
    ]
  }

  if (status === 'paused') {
    return [
      createCommandButton('继续', { type: 'speech/resume' }),
      createCommandButton('停止', { type: 'speech/stop' }, true),
    ]
  }

  return [createDisabledButton('请稍候')]
}

function createCommandButton(
  label: string,
  message: unknown,
  danger = false,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  Object.assign(button.style, {
    minWidth: '76px',
    border: `1px solid ${danger ? 'rgba(248, 113, 113, 0.7)' : 'rgba(125, 211, 252, 0.7)'}`,
    borderRadius: '6px',
    background: danger ? 'rgba(127, 29, 29, 0.34)' : 'rgba(56, 189, 248, 0.18)',
    color: danger ? '#fecaca' : '#e0f2fe',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  })
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    void sendCommand(message)
  })

  return button
}

async function sendCommand(message: unknown): Promise<void> {
  applyOptimisticStatus(message)

  try {
    const response = await getChromeRuntime()?.sendMessage?.(message)
    if (isErrorResponse(response)) {
      status = 'error'
      errorText = normalizeCommandError(response.error)
      renderPanel()
    }
  } catch (error) {
    status = 'error'
    errorText =
      error instanceof Error
        ? normalizeCommandError(error.message)
        : '扩展后台处理失败'
    renderPanel()
  }
}

function normalizeCommandError(message: string): string {
  if (
    message.includes('Extension has not been invoked') ||
    message.includes('activeTab permission')
  ) {
    return '请先点击浏览器工具栏里的莫莫实时字幕图标激活当前页面，再点击开始翻译。'
  }

  if (message.includes('Chrome pages cannot be captured')) {
    return '浏览器内置页面不能捕获声音，请切换到普通网页后再开始翻译。'
  }

  return message
}

function applyOptimisticStatus(message: unknown): void {
  if (!isRecord(message) || typeof message.type !== 'string') return

  switch (message.type) {
    case 'speech/start':
      status = 'connecting'
      errorText = ''
      break
    case 'speech/pause':
      status = 'paused'
      break
    case 'speech/resume':
      status = 'translating'
      break
    case 'speech/stop':
      status = 'stopping'
      break
    default:
      return
  }

  renderPanel()
}

function isErrorResponse(
  response: unknown,
): response is { ok: false; error: string } {
  return (
    isRecord(response) &&
    response.ok === false &&
    typeof response.error === 'string'
  )
}

function createDisabledButton(label: string): HTMLButtonElement {
  const button = createCommandButton(label, { type: 'noop' })
  button.disabled = true
  Object.assign(button.style, {
    cursor: 'wait',
    opacity: '0.68',
  })

  return button
}

function removeOverlay(): void {
  document.querySelector(PANEL_SELECTOR)?.remove()
  document.querySelector(OVERLAY_SELECTOR)?.remove()
}

function removeBubble(): void {
  document.querySelector(BUBBLE_SELECTOR)?.remove()
}

function isCaptionMessage(message: unknown): message is CaptionMessage {
  return (
    isRecord(message) &&
    'type' in message &&
    (message.type === 'speech/snapshot' ||
      message.type === 'speech/stop' ||
      message.type === 'ui/open-panel')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getChromeRuntime(): RuntimeMessageApi['runtime'] | undefined {
  return (globalThis as typeof globalThis & { chrome?: RuntimeMessageApi })
    .chrome?.runtime
}

initializeContentScriptOverlay()
