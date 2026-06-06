/**
 * 注入到目标网页的内容脚本 (Content Script)。
 * 负责在目标网页中渲染“悬浮翻译气泡”和“底部实时字幕面板”，
 * 并监听来自 background script 的状态更新，以保持网页字幕与后台音频翻译状态同步。
 */
import {
  CAPTION_SKIN_STORAGE_KEY,
  CAPTION_SKINS,
  DEFAULT_CAPTION_SKIN_ID,
  getCaptionSkin,
  type CaptionSkin,
  type CaptionSkinId,
} from './caption-skins'

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
    getURL?: (path: string) => string
    sendMessage?: (message: unknown) => Promise<unknown> | void
    onMessage?: {
      addListener?: (listener: (message: unknown) => void) => void
    }
  }
  storage?: {
    local?: StorageLocalApi
  }
}

type StorageLocalApi = {
  get?: (
    key: string,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>
  set?: (items: Record<string, unknown>) => Promise<void> | void
}

const OVERLAY_SELECTOR = '[data-momo-caption-overlay]'
const BUBBLE_SELECTOR = '[data-momo-caption-bubble]'
const PANEL_SELECTOR = '[data-momo-caption-panel]'
const VIEWPORT_MARGIN = 16
const BUBBLE_EDGE_MARGIN = 24
const BUBBLE_SIZE = 48
const PANEL_WIDTH = 1086
const PANEL_HEIGHT = 362
const DRAG_CLICK_THRESHOLD = 4

let initialized = false
let captionText = ''
let status = 'idle'
let errorText = ''
let viewMode: 'bubble' | 'panel' = 'bubble'
let stopConfirming = false
let skinMenuOpen = false
let hasSavableCaption = false
let bubblePosition: BubblePosition | null = null
let panelPosition: Position | null = null
let currentSkinId: CaptionSkinId = DEFAULT_CAPTION_SKIN_ID

type Position = {
  left: number
  top: number
}

type BubblePosition = {
  edge: 'left' | 'right'
  top: number
}

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
  window.addEventListener('resize', clampStoredPositions)
  renderBubble()
  void loadStoredSkin()
  getChromeRuntime()?.onMessage?.addListener?.(handleMessage)
}

async function loadStoredSkin(): Promise<void> {
  try {
    const stored = await getChromeStorage()?.get?.(CAPTION_SKIN_STORAGE_KEY)
    const nextSkin = getCaptionSkin(stored?.[CAPTION_SKIN_STORAGE_KEY])
    currentSkinId = nextSkin.id
    rerenderCurrentView()
  } catch {
    currentSkinId = DEFAULT_CAPTION_SKIN_ID
  }
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
    stopConfirming = false
    skinMenuOpen = false
    hasSavableCaption = false
    viewMode = 'bubble'
    renderBubble()
    return
  }

  const text = getLatestCaptionText(message)
  captionText = text
  status = message.snapshot?.status ?? status
  errorText = message.snapshot?.error ?? ''
  hasSavableCaption = hasValidCaption(message)

  if (hasSnapshotError(message)) {
    status = 'error'
    errorText = message.snapshot?.error ?? '翻译异常'
    stopConfirming = false
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

function hasValidCaption(
  message: Extract<CaptionMessage, { type: 'speech/snapshot' }>,
): boolean {
  return (
    message.snapshot?.sentences?.some((sentence) =>
      Boolean(sentence.targetText?.trim()),
    ) ?? false
  )
}

function renderBubble(): void {
  removeOverlay()

  if (document.querySelector(BUBBLE_SELECTOR)) {
    return
  }

  const bubble = document.createElement('button')
  const skin = getCurrentSkin()
  bubble.type = 'button'
  bubble.dataset.momoCaptionBubble = 'true'
  bubble.setAttribute('aria-label', '展开实时字幕')
  bubble.textContent = '译'
  Object.assign(bubble.style, {
    position: 'fixed',
    zIndex: '2147483647',
    width: `${BUBBLE_SIZE}px`,
    height: `${BUBBLE_SIZE}px`,
    border: '0',
    borderRadius: '999px',
    background: skin.bubbleBackground,
    color: skin.bubbleColor,
    fontSize: '18px',
    fontWeight: '700',
    lineHeight: '48px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.28)',
    cursor: 'pointer',
  })

  applyBubblePosition(bubble)
  const dragState = makeDraggable(bubble, {
    getPosition: getCurrentBubbleDragPosition,
    onMove: (position) => {
      bubblePosition = {
        edge:
          position.left + BUBBLE_SIZE / 2 < window.innerWidth / 2
            ? 'left'
            : 'right',
        top: clamp(position.top, VIEWPORT_MARGIN, getBubbleMaxTop()),
      }
      Object.assign(bubble.style, {
        left: `${position.left}px`,
        right: '',
        top: `${bubblePosition.top}px`,
        bottom: '',
      })
    },
    onEnd: (position) => {
      const edge =
        position.left + BUBBLE_SIZE / 2 < window.innerWidth / 2
          ? 'left'
          : 'right'
      bubblePosition = {
        edge,
        top: clamp(position.top, VIEWPORT_MARGIN, getBubbleMaxTop()),
      }
      applyBubblePosition(bubble)
    },
    size: {
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
    },
  })

  bubble.addEventListener('click', () => {
    if (dragState.wasDragged()) {
      return
    }

    viewMode = 'panel'
    renderPanel()
  })
  document.body.append(bubble)
}

function renderPanel(): void {
  removeBubble()
  removeOverlay()

  const panel = document.createElement('div')
  const skin = getCurrentSkin()
  panel.dataset.momoCaptionPanel = 'true'
  Object.assign(panel.style, {
    position: 'fixed',
    zIndex: '2147483647',
    width: `${PANEL_WIDTH}px`,
    height: `${PANEL_HEIGHT}px`,
    maxWidth: 'calc(100vw - 32px)',
    boxSizing: 'border-box',
    padding: '10px 48px 10px 16px',
    borderRadius: '8px',
    background: skin.panelBackground,
    color: skin.panelColor,
    fontSize: '20px',
    lineHeight: '1.5',
    textAlign: 'center',
    pointerEvents: 'auto',
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    boxShadow: skin.shadow,
    display: 'flex',
    flexDirection: 'column',
  })
  applyPanelSkinBackground(panel, skin)
  applyPanelPosition(panel)

  const header = document.createElement('div')
  header.dataset.momoCaptionDragHandle = 'true'
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '8px',
    paddingRight: '24px',
    color: skin.headerColor,
    fontSize: '16px',
    lineHeight: '1.4',
    cursor: 'move',
    userSelect: 'none',
  })

  const title = document.createElement('strong')
  title.textContent = '莫莫实时字幕'
  Object.assign(title.style, {
    color: skin.titleColor,
    fontSize: '18px',
  })

  const statusNode = document.createElement('span')
  statusNode.textContent = statusLabels[status] ?? status
  const statusDot = document.createElement('span')
  Object.assign(statusDot.style, {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    marginRight: '8px',
    borderRadius: '999px',
    background: skin.statusDotColor,
    verticalAlign: 'middle',
  })
  statusNode.prepend(statusDot)
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
    color: skin.overlayColor,
    textShadow: skin.backgroundImagePath
      ? '0 2px 12px rgba(0, 0, 0, 0.55)'
      : '',
  })

  const errorNode = document.createElement('div')
  errorNode.textContent = errorText
  Object.assign(errorNode.style, {
    display: errorText ? 'block' : 'none',
    marginTop: '8px',
    color: skin.errorColor,
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
  controls.append(...createControlButtons(skin))

  const skinButton = document.createElement('button')
  skinButton.type = 'button'
  skinButton.dataset.momoCaptionSkinToggle = 'true'
  skinButton.setAttribute('aria-label', '切换字幕皮肤')
  skinButton.textContent = '皮肤'
  Object.assign(skinButton.style, {
    position: 'absolute',
    top: '8px',
    right: '42px',
    minWidth: '44px',
    height: '24px',
    border: '0',
    borderRadius: '6px',
    background: skin.subtleButtonBackground,
    color: skin.subtleButtonColor,
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: '20px',
    cursor: 'pointer',
  })
  skinButton.addEventListener('click', (event) => {
    event.stopPropagation()
    skinMenuOpen = !skinMenuOpen
    renderPanel()
  })

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
    background: skin.subtleButtonBackground,
    color: skin.subtleButtonColor,
    fontSize: '18px',
    lineHeight: '20px',
    cursor: 'pointer',
  })
  minimizeButton.addEventListener('click', (event) => {
    event.stopPropagation()
    viewMode = 'bubble'
    skinMenuOpen = false
    renderBubble()
  })
  panel.append(header, overlay, errorNode, controls, skinButton, minimizeButton)
  if (skinMenuOpen) {
    panel.append(createSkinMenu(skin))
  }
  document.body.append(panel)
  makeDraggable(header, {
    getPosition: () => getPanelPosition(),
    onMove: (position) => {
      panelPosition = clampPanelPosition(position)
      applyPanelPosition(panel)
    },
    size: {
      width: getPanelRenderedWidth(),
      height: PANEL_HEIGHT,
    },
  })
}

function applyPanelSkinBackground(panel: HTMLElement, skin: CaptionSkin): void {
  if (!skin.backgroundImagePath) {
    return
  }

  const imageUrl =
    getChromeRuntime()?.getURL?.(skin.backgroundImagePath) ??
    skin.backgroundImagePath
  Object.assign(panel.style, {
    backgroundColor: skin.panelBackground,
    backgroundImage: `${skin.imageOverlay ?? 'linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55))'}, url("${imageUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  })
}

function createSkinMenu(skin: CaptionSkin): HTMLElement {
  const menu = document.createElement('div')
  menu.dataset.momoCaptionSkinMenu = 'true'
  Object.assign(menu.style, {
    position: 'absolute',
    top: '38px',
    right: '10px',
    zIndex: '1',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(86px, 1fr))',
    gap: '6px',
    padding: '8px',
    borderRadius: '8px',
    background: skin.backgroundImagePath
      ? 'rgba(15, 23, 42, 0.72)'
      : skin.subtleButtonBackground,
    boxShadow: skin.shadow,
    backdropFilter: 'blur(10px)',
  })

  for (const option of CAPTION_SKINS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = option.label
    Object.assign(button.style, {
      border: `1px solid ${
        option.id === currentSkinId ? skin.actionBorder : 'transparent'
      }`,
      borderRadius: '6px',
      background:
        option.id === currentSkinId
          ? skin.actionBackground
          : skin.subtleButtonBackground,
      color: skin.subtleButtonColor,
      padding: '6px 8px',
      fontSize: '12px',
      fontWeight: '700',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    })
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      void selectSkin(option.id)
    })
    menu.append(button)
  }

  return menu
}

async function selectSkin(skinId: CaptionSkinId): Promise<void> {
  currentSkinId = skinId
  skinMenuOpen = false
  renderPanel()

  try {
    await getChromeStorage()?.set?.({
      [CAPTION_SKIN_STORAGE_KEY]: skinId,
    })
  } catch {
    // 皮肤保存失败不影响字幕展示。
  }
}

function createControlButtons(skin: CaptionSkin): HTMLButtonElement[] {
  if (stopConfirming) {
    return [
      createCommandButton(
        '保存并停止',
        {
          type: 'speech/stop',
          saveHistory: true,
        },
        false,
        skin,
      ),
      createCommandButton(
        '不保存',
        {
          type: 'speech/stop',
          saveHistory: false,
        },
        true,
        skin,
      ),
      createCancelStopButton(skin),
    ]
  }

  if (status === 'idle' || status === 'error') {
    return [
      createCommandButton(
        status === 'error' ? '重新开始' : '开始翻译',
        {
          type: 'speech/start',
        },
        false,
        skin,
      ),
    ]
  }

  if (status === 'translating') {
    return [
      createCommandButton('暂停', { type: 'speech/pause' }, false, skin),
      createStopButton(skin),
    ]
  }

  if (status === 'paused') {
    return [
      createCommandButton('继续', { type: 'speech/resume' }, false, skin),
      createStopButton(skin),
    ]
  }

  return [createDisabledButton('请稍候', skin)]
}

function createStopButton(skin: CaptionSkin): HTMLButtonElement {
  const button = createStyledControlButton('停止', true, skin)
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    if (!hasSavableCaption) {
      void sendCommand({
        type: 'speech/stop',
        saveHistory: false,
      })
      return
    }

    stopConfirming = true
    skinMenuOpen = false
    renderPanel()
  })

  return button
}

function createCancelStopButton(skin: CaptionSkin): HTMLButtonElement {
  const button = createStyledControlButton('取消', false, skin)
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    stopConfirming = false
    renderPanel()
  })

  return button
}

function createCommandButton(
  label: string,
  message: unknown,
  danger = false,
  skin = getCurrentSkin(),
): HTMLButtonElement {
  const button = createStyledControlButton(label, danger, skin)
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    void sendCommand(message)
  })

  return button
}

function createStyledControlButton(
  label: string,
  danger = false,
  skin = getCurrentSkin(),
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  Object.assign(button.style, {
    minWidth: '76px',
    border: `1px solid ${danger ? 'rgba(248, 113, 113, 0.7)' : skin.actionBorder}`,
    borderRadius: '6px',
    background: danger ? 'rgba(127, 29, 29, 0.34)' : skin.actionBackground,
    color: danger ? '#fecaca' : skin.actionColor,
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  })
  return button
}

async function sendCommand(message: unknown): Promise<void> {
  stopConfirming = false
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
      skinMenuOpen = false
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

function createDisabledButton(
  label: string,
  skin: CaptionSkin,
): HTMLButtonElement {
  const button = createCommandButton(label, { type: 'noop' }, false, skin)
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

function getCurrentSkin(): CaptionSkin {
  return getCaptionSkin(currentSkinId)
}

function rerenderCurrentView(): void {
  if (viewMode === 'panel') {
    renderPanel()
    return
  }

  renderBubble()
}

function applyBubblePosition(bubble: HTMLElement): void {
  const position = getBubblePosition()
  Object.assign(bubble.style, {
    left: position.edge === 'left' ? `${BUBBLE_EDGE_MARGIN}px` : '',
    right: position.edge === 'right' ? `${BUBBLE_EDGE_MARGIN}px` : '',
    top: `${position.top}px`,
    bottom: '',
  })
}

function getBubblePosition(): BubblePosition {
  if (!bubblePosition) {
    bubblePosition = {
      edge: 'right',
      top: getBubbleMaxTop() - BUBBLE_EDGE_MARGIN + VIEWPORT_MARGIN,
    }
  }

  bubblePosition.top = clamp(
    bubblePosition.top,
    VIEWPORT_MARGIN,
    getBubbleMaxTop(),
  )

  return bubblePosition
}

function getCurrentBubbleDragPosition(): Position {
  const position = getBubblePosition()

  return {
    left:
      position.edge === 'left'
        ? BUBBLE_EDGE_MARGIN
        : window.innerWidth - BUBBLE_EDGE_MARGIN - BUBBLE_SIZE,
    top: position.top,
  }
}

function getBubbleMaxTop(): number {
  return Math.max(
    VIEWPORT_MARGIN,
    window.innerHeight - BUBBLE_SIZE - VIEWPORT_MARGIN,
  )
}

function applyPanelPosition(panel: HTMLElement): void {
  const position = getPanelPosition()
  Object.assign(panel.style, {
    left: `${position.left}px`,
    top: `${position.top}px`,
    right: '',
    bottom: '',
    transform: '',
  })
}

function getPanelPosition(): Position {
  if (!panelPosition) {
    panelPosition = {
      left: Math.round((window.innerWidth - getPanelRenderedWidth()) / 2),
      top: Math.round(
        window.innerHeight - PANEL_HEIGHT - window.innerHeight * 0.08,
      ),
    }
  }

  panelPosition = clampPanelPosition(panelPosition)

  return panelPosition
}

function clampPanelPosition(position: Position): Position {
  return clampPosition(position, {
    width: getPanelRenderedWidth(),
    height: PANEL_HEIGHT,
  })
}

function getPanelRenderedWidth(): number {
  return Math.max(
    0,
    Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
  )
}

function clampStoredPositions(): void {
  if (bubblePosition) {
    bubblePosition.top = clamp(
      bubblePosition.top,
      VIEWPORT_MARGIN,
      getBubbleMaxTop(),
    )
  }

  if (panelPosition) {
    panelPosition = clampPanelPosition(panelPosition)
  }
}

function makeDraggable(
  element: HTMLElement,
  options: {
    getPosition: () => Position
    onMove: (position: Position) => void
    onEnd?: (position: Position) => void
    size: {
      width: number
      height: number
    }
  },
): { wasDragged: () => boolean } {
  let activePointerId: number | null = null
  let startPointer: Position | null = null
  let startPosition: Position | null = null
  let dragged = false
  let suppressNextClick = false

  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return
    }

    activePointerId = event.pointerId
    startPointer = {
      left: event.clientX,
      top: event.clientY,
    }
    startPosition = options.getPosition()
    dragged = false
    element.setPointerCapture?.(event.pointerId)
  })

  element.addEventListener('pointermove', (event) => {
    if (
      activePointerId !== event.pointerId ||
      !startPointer ||
      !startPosition
    ) {
      return
    }

    const deltaX = event.clientX - startPointer.left
    const deltaY = event.clientY - startPointer.top
    dragged = dragged || Math.hypot(deltaX, deltaY) > DRAG_CLICK_THRESHOLD

    if (!dragged) {
      return
    }

    event.preventDefault()
    options.onMove(
      clampPosition(
        {
          left: startPosition.left + deltaX,
          top: startPosition.top + deltaY,
        },
        options.size,
      ),
    )
  })

  element.addEventListener('pointerup', (event) => {
    if (
      activePointerId !== event.pointerId ||
      !startPointer ||
      !startPosition
    ) {
      return
    }

    const deltaX = event.clientX - startPointer.left
    const deltaY = event.clientY - startPointer.top
    const nextPosition = clampPosition(
      {
        left: startPosition.left + deltaX,
        top: startPosition.top + deltaY,
      },
      options.size,
    )

    if (dragged) {
      event.preventDefault()
      suppressNextClick = true
      options.onEnd?.(nextPosition)
    }

    element.releasePointerCapture?.(event.pointerId)
    activePointerId = null
    startPointer = null
    startPosition = null
  })

  return {
    wasDragged: () => {
      const result = suppressNextClick
      suppressNextClick = false
      return result
    },
  }
}

function clampPosition(
  position: Position,
  size: { width: number; height: number },
): Position {
  return {
    left: clamp(
      Math.round(position.left),
      VIEWPORT_MARGIN,
      Math.max(
        VIEWPORT_MARGIN,
        window.innerWidth - size.width - VIEWPORT_MARGIN,
      ),
    ),
    top: clamp(
      Math.round(position.top),
      VIEWPORT_MARGIN,
      Math.max(
        VIEWPORT_MARGIN,
        window.innerHeight - size.height - VIEWPORT_MARGIN,
      ),
    ),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
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

function getChromeStorage(): StorageLocalApi | undefined {
  return (globalThis as typeof globalThis & { chrome?: RuntimeMessageApi })
    .chrome?.storage?.local
}

initializeContentScriptOverlay()
