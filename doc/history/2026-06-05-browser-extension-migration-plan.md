# Browser Extension Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前普通 Vite React 页面迁移为同时支持 Chrome 和 Edge 的 Manifest V3 浏览器插件，并保留已完成的实时英译中核心链路。

**Architecture:** 保留 `SpeechTranslateClient`、`TranscriptStore`、`SpeechTranslationController` 和 `AudioSource` 接口，把普通页面运行时拆成 Popup/Side Panel UI、Background Service Worker、Offscreen Document 和 Content Script。插件阶段新增 `TabAudioSource`，由 Service Worker 获取当前标签页音频流 ID，Offscreen Document 消费流并承载持续音频处理，UI 通过 Chrome Messaging 订阅状态和发送控制命令。

**Tech Stack:** React 19、TypeScript、Vite 8、Tailwind CSS、Vitest、Testing Library、Playwright、Chrome Extension Manifest V3、`chrome.tabCapture`、`chrome.offscreen`、`chrome.runtime` messaging。

---

## References

- Chrome `tabCapture`：当前标签页音视频捕获只能在用户调用扩展后启动；`getMediaStreamId()` 返回的 stream ID 可交给 Offscreen Document 使用；捕获标签页音频后需要自行接回默认输出以保持用户可听。
  https://developer.chrome.com/docs/extensions/mv2/reference/tabCapture
- Chrome `offscreen`：Offscreen Document 用于在隐藏文档中使用 DOM API；创建时需要 `url`、`reasons` 和 `justification`；Offscreen Document 主要通过 `chrome.runtime` messaging 通信。
  https://developer.chrome.com/docs/extensions/reference/offscreen
- Microsoft Edge Manifest V3：Edge 扩展使用 `manifest.json`，Manifest V3 背景页改为 Service Worker，并遵循 Chromium 扩展平台方向。
  https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/manifest-v3
- Microsoft Edge manifest 格式：Edge 支持 Manifest V3 字段，包含 `background.service_worker`、`side_panel`、`permissions`、`host_permissions` 等。
  https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/manifest-format

## Current State

- 已完成普通网站形态：`src/App.tsx` 挂载 `SpeechTranslationPanel`。
- 核心链路已按文档分层：音频、腾讯云客户端、字幕 Store、Controller、UI 分离。
- `MicrophoneAudioSource` 已实现麦克风输入；插件阶段需要新增 `TabAudioSource` 捕获当前标签页音频。
- 现有 E2E 使用 Vite dev server，当前本地存在 dev server 生命周期不稳定问题，插件 E2E 先以构建产物和手工验收为主。

## Target File Structure

```text
public/
  manifest.json
  popup.html
  side-panel.html
  offscreen.html
  icons/
    icon-16.png
    icon-32.png
    icon-48.png
    icon-128.png

src/
  extension/
    background.ts
    content-script.ts
    messaging.ts
    offscreen.ts
    popup.tsx
    side-panel.tsx
    extension-controller-host.ts
    extension-controller-host.test.ts
    messaging.test.ts
  features/
    speech-translation/
      audio/
        tab-audio-source.ts
        tab-audio-source.test.ts
      SpeechTranslationPanel.tsx
      speech-translation-controller.ts

tests/
  e2e/
    extension.spec.ts

vite.config.ts
package.json
```

## Messaging Contract

所有插件上下文只通过结构化消息通信，禁止跨文件共享全局状态。

```typescript
export type ExtensionCommand =
  | { type: 'speech/start'; tabId: number }
  | { type: 'speech/pause' }
  | { type: 'speech/resume' }
  | { type: 'speech/stop' }
  | { type: 'speech/get-snapshot' }

export type ExtensionEvent =
  | { type: 'speech/snapshot'; snapshot: SpeechTranslationSnapshot }
  | { type: 'speech/error'; message: string }

export type OffscreenCommand =
  | { type: 'offscreen/start-tab-audio'; streamId: string }
  | { type: 'offscreen/pause' }
  | { type: 'offscreen/resume' }
  | { type: 'offscreen/stop' }
```

## Task 1: Add Manifest V3 Build Entrypoints

**Files:**
- Create: `public/manifest.json`
- Create: `public/popup.html`
- Create: `public/side-panel.html`
- Create: `public/offscreen.html`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Test: `src/extension/manifest.test.ts`

- [ ] **Step 1: Write the failing manifest test**

Create `src/extension/manifest.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import manifest from '../../public/manifest.json'

describe('extension manifest', () => {
  it('uses Manifest V3 and declares required extension surfaces', () => {
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.action.default_popup).toBe('popup.html')
    expect(manifest.side_panel.default_path).toBe('side-panel.html')
    expect(manifest.background.service_worker).toBe('assets/background.js')
  })

  it('declares only the permissions needed for tab audio translation', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['activeTab', 'tabCapture', 'offscreen', 'sidePanel']),
    )
    expect(manifest.host_permissions).toContain('wss://asr.cloud.tencent.com/*')
  })
})
```

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run src/extension/manifest.test.ts`

Expected: FAIL because `public/manifest.json` does not exist.

- [ ] **Step 3: Add MV3 manifest and HTML shells**

Create `public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "莫莫实时字幕",
  "description": "个人比赛演示用实时英译中浏览器插件。",
  "version": "0.1.0",
  "action": {
    "default_popup": "popup.html",
    "default_title": "莫莫实时字幕"
  },
  "side_panel": {
    "default_path": "side-panel.html"
  },
  "background": {
    "service_worker": "assets/background.js",
    "type": "module"
  },
  "permissions": ["activeTab", "tabCapture", "offscreen", "sidePanel"],
  "host_permissions": ["wss://asr.cloud.tencent.com/*"],
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Create minimal HTML shells with a `root` div and module scripts:

- `public/popup.html` loads `/src/extension/popup.tsx`
- `public/side-panel.html` loads `/src/extension/side-panel.tsx`
- `public/offscreen.html` loads `/src/extension/offscreen.ts`

Modify `vite.config.ts` build input so Vite emits the HTML pages and service worker:

```typescript
build: {
  rollupOptions: {
    input: {
      main: 'index.html',
      popup: 'public/popup.html',
      sidePanel: 'public/side-panel.html',
      offscreen: 'public/offscreen.html',
      background: 'src/extension/background.ts',
      contentScript: 'src/extension/content-script.ts',
    },
    output: {
      entryFileNames: (chunk) =>
        ['background', 'contentScript'].includes(chunk.name)
          ? 'assets/[name].js'
          : 'assets/[name]-[hash].js',
    },
  },
}
```

- [ ] **Step 4: Run manifest test**

Run: `pnpm vitest run src/extension/manifest.test.ts`

Expected: PASS.

- [ ] **Step 5: Run build**

Run: `pnpm build`

Expected: `dist/manifest.json` exists and `dist/assets/background.js` is emitted.

## Task 2: Define Extension Messaging

**Files:**
- Create: `src/extension/messaging.ts`
- Create: `src/extension/messaging.test.ts`

- [ ] **Step 1: Write failing tests for message guards**

Create `src/extension/messaging.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { isExtensionCommand, isOffscreenCommand } from './messaging'

describe('extension messaging', () => {
  it('accepts known speech commands and rejects unknown messages', () => {
    expect(isExtensionCommand({ type: 'speech/start', tabId: 1 })).toBe(true)
    expect(isExtensionCommand({ type: 'speech/stop' })).toBe(true)
    expect(isExtensionCommand({ type: 'speech/start' })).toBe(false)
    expect(isExtensionCommand({ type: 'unknown' })).toBe(false)
  })

  it('accepts known offscreen commands', () => {
    expect(
      isOffscreenCommand({
        type: 'offscreen/start-tab-audio',
        streamId: 'stream-id',
      }),
    ).toBe(true)
    expect(isOffscreenCommand({ type: 'offscreen/start-tab-audio' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run src/extension/messaging.test.ts`

Expected: FAIL because `messaging.ts` does not exist.

- [ ] **Step 3: Implement message types and guards**

Create `src/extension/messaging.ts` using the contract above. Guards must validate required fields, especially `tabId` and `streamId`.

- [ ] **Step 4: Run test**

Run: `pnpm vitest run src/extension/messaging.test.ts`

Expected: PASS.

## Task 3: Build Extension Controller Host

**Files:**
- Create: `src/extension/extension-controller-host.ts`
- Create: `src/extension/extension-controller-host.test.ts`
- Modify: `src/features/speech-translation/create-speech-translation.ts`

- [ ] **Step 1: Write failing tests for command routing**

Test that the host:

- creates one controller per active session.
- routes `speech/start` to `controller.start()`.
- emits `speech/snapshot` when the controller snapshot changes.
- routes `speech/pause`, `speech/resume`, and `speech/stop`.
- disposes the controller on stop/error cleanup.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run src/extension/extension-controller-host.test.ts`

Expected: FAIL because host does not exist.

- [ ] **Step 3: Implement host with dependency injection**

`ExtensionControllerHost` should accept:

```typescript
interface HostDependencies {
  createController: () => SpeechTranslationController
  sendEvent: (event: ExtensionEvent) => void
}
```

Do not import Chrome APIs in this file. Keep it unit-testable.

- [ ] **Step 4: Run host tests**

Run: `pnpm vitest run src/extension/extension-controller-host.test.ts`

Expected: PASS.

## Task 4: Implement Background Service Worker

**Files:**
- Create: `src/extension/background.ts`
- Test: `src/extension/background.test.ts`

- [ ] **Step 1: Write failing tests with mocked `chrome` APIs**

Cover:

- `chrome.runtime.onMessage` receives `speech/start`.
- service worker calls `chrome.tabs.query` or uses sender/action context to identify active tab.
- service worker calls `chrome.tabCapture.getMediaStreamId({ targetTabId })`.
- service worker ensures offscreen document exists before sending `offscreen/start-tab-audio`.
- unsupported commands return a Chinese error.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run src/extension/background.test.ts`

Expected: FAIL because `background.ts` is not implemented.

- [ ] **Step 3: Implement background message handling**

Implementation rules:

- Use `chrome.runtime.onMessage.addListener`.
- Use Promise-compatible MV3 APIs where available.
- Create Offscreen Document with:

```typescript
await chrome.offscreen.createDocument({
  url: 'offscreen.html',
  reasons: ['USER_MEDIA'],
  justification: 'Capture current tab audio and translate it in real time.',
})
```

- Generate stream ID using:

```typescript
const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId })
```

- Send `offscreen/start-tab-audio` to Offscreen Document.

- [ ] **Step 4: Run background tests**

Run: `pnpm vitest run src/extension/background.test.ts`

Expected: PASS.

## Task 5: Add `TabAudioSource`

**Files:**
- Create: `src/features/speech-translation/audio/tab-audio-source.ts`
- Create: `src/features/speech-translation/audio/tab-audio-source.test.ts`
- Reuse: `src/features/speech-translation/audio/pcm.ts`
- Reuse: `src/features/speech-translation/audio/audio-worklet-code.ts`

- [ ] **Step 1: Write failing tests**

Test behavior:

- consumes a `streamId` with `navigator.mediaDevices.getUserMedia`.
- requests `chromeMediaSource: 'tab'` and `chromeMediaSourceId`.
- converts captured audio through existing PCM chunking.
- connects captured tab audio back to `AudioContext.destination` so users can still hear the tab.
- `pause()` suspends the context without stopping tracks.
- `stop()` closes context, stops tracks, revokes Worklet URL, clears chunker.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run src/features/speech-translation/audio/tab-audio-source.test.ts`

Expected: FAIL because `TabAudioSource` does not exist.

- [ ] **Step 3: Implement `TabAudioSource`**

Implementation should mirror `MicrophoneAudioSource`, but replace `getUserMedia` constraints:

```typescript
{
  audio: {
    mandatory: {
      chromeMediaSource: 'tab',
      chromeMediaSourceId: streamId,
    },
  },
  video: false,
}
```

Keep the output format identical to `MicrophoneAudioSource`.

- [ ] **Step 4: Run audio tests**

Run: `pnpm vitest run src/features/speech-translation/audio/tab-audio-source.test.ts src/features/speech-translation/audio/microphone-audio-source.test.ts src/features/speech-translation/audio/pcm.test.ts`

Expected: PASS.

## Task 6: Implement Offscreen Runtime

**Files:**
- Create: `src/extension/offscreen.ts`
- Test: `src/extension/offscreen.test.ts`
- Modify: `src/features/speech-translation/create-speech-translation.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- receiving `offscreen/start-tab-audio` creates a `TabAudioSource`.
- controller starts and emits snapshots back through `chrome.runtime.sendMessage`.
- pause/resume/stop commands call matching controller methods.
- stop disposes resources and leaves Offscreen Document idle.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run src/extension/offscreen.test.ts`

Expected: FAIL because `offscreen.ts` is not implemented.

- [ ] **Step 3: Implement Offscreen Document controller host**

Implementation rules:

- No React in Offscreen Document.
- Construct `SpeechTranslationController` with `TabAudioSource`.
- Send `speech/snapshot` events through `chrome.runtime.sendMessage`.
- Convert unknown messages to Chinese errors and log with `logSpeechError`.

- [ ] **Step 4: Run offscreen tests**

Run: `pnpm vitest run src/extension/offscreen.test.ts`

Expected: PASS.

## Task 7: Split Popup and Side Panel UI

**Files:**
- Create: `src/extension/popup.tsx`
- Create: `src/extension/side-panel.tsx`
- Create: `src/extension/use-extension-speech-translation.ts`
- Test: `src/extension/use-extension-speech-translation.test.tsx`
- Modify: `src/features/speech-translation/SpeechTranslationPanel.tsx`

- [ ] **Step 1: Write failing hook tests**

Test that the hook:

- sends `speech/get-snapshot` on mount.
- subscribes to `speech/snapshot` messages.
- sends `speech/start`, `speech/pause`, `speech/resume`, and `speech/stop`.
- passes current active tab ID on start.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run src/extension/use-extension-speech-translation.test.tsx`

Expected: FAIL because hook does not exist.

- [ ] **Step 3: Implement extension UI adapter**

Keep `SpeechTranslationPanel` presentational by allowing a controller-like prop or action adapter. Popup should be compact and focused on controls/status. Side Panel should show full subtitles.

- [ ] **Step 4: Run UI tests**

Run: `pnpm vitest run src/extension/use-extension-speech-translation.test.tsx src/features/speech-translation/SpeechTranslationPanel.test.tsx`

Expected: PASS.

## Task 8: Add Content Script Overlay

**Files:**
- Create: `src/extension/content-script.ts`
- Create: `src/extension/content-script.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- injects one subtitle container into the page.
- updates Chinese subtitle text on `speech/snapshot`.
- removes or clears overlay on stop/error.
- does not duplicate overlay when injected multiple times.

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm vitest run src/extension/content-script.test.ts`

Expected: FAIL because content script does not exist.

- [ ] **Step 3: Implement minimal overlay**

Use a fixed-position container with isolated class names. Do not use Tailwind in content script unless styles are injected explicitly, because page CSS can conflict.

- [ ] **Step 4: Run content script tests**

Run: `pnpm vitest run src/extension/content-script.test.ts`

Expected: PASS.

## Task 9: Update Build and Package Scripts

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `scripts/verify-extension-build.ps1`

- [ ] **Step 1: Write build verification script**

Create `scripts/verify-extension-build.ps1` to check:

- `dist/manifest.json`
- `dist/popup.html`
- `dist/side-panel.html`
- `dist/offscreen.html`
- `dist/assets/background.js`
- icons exist

- [ ] **Step 2: Add package scripts**

Add:

```json
{
  "build:extension": "vite build",
  "check:extension": "pnpm build:extension && powershell -ExecutionPolicy Bypass -File scripts/verify-extension-build.ps1"
}
```

- [ ] **Step 3: Run extension build check**

Run: `pnpm check:extension`

Expected: PASS and all expected files exist.

## Task 10: Extension E2E and Manual Verification

**Files:**
- Create: `tests/e2e/extension.spec.ts`
- Modify: `playwright.config.ts`
- Create: `doc/extension-manual-test-checklist.md`

- [ ] **Step 1: Add Playwright extension launch test**

Use Chromium persistent context and load `dist` as an unpacked extension. Test at minimum:

- extension loads.
- popup page renders.
- side panel page renders if directly opened by extension URL.
- content script can inject subtitle container on a normal HTTPS page fixture.

- [ ] **Step 2: Run E2E**

Run: `pnpm test:e2e`

Expected: PASS. If local Vite web server still causes hang, split extension E2E into a separate config that does not start `webServer`.

- [ ] **Step 3: Add manual checklist**

Create `doc/extension-manual-test-checklist.md`:

```markdown
# Extension Manual Test Checklist

- [ ] `pnpm build:extension`
- [ ] Chrome: open `chrome://extensions`, enable Developer mode, load `dist`.
- [ ] Edge: open `edge://extensions`, enable Developer mode, load `dist`.
- [ ] Open a video/audio tab.
- [ ] Click extension action and start translation.
- [ ] Confirm tab audio remains audible.
- [ ] Confirm subtitles update in Side Panel.
- [ ] Pause and resume.
- [ ] Stop and verify resources are released.
- [ ] Navigate the captured tab and confirm expected capture behavior.
- [ ] Close the tab and verify UI enters a readable error/idle state.
```

## Task 11: Full Regression

**Files:**
- No production file changes.

- [ ] **Step 1: Run unit tests**

Run: `pnpm test:unit`

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run lint and stylelint**

Run:

```powershell
pnpm lint
pnpm stylelint
```

Expected: exit code 0 for both.

- [ ] **Step 4: Run extension build**

Run: `pnpm check:extension`

Expected: exit code 0.

- [ ] **Step 5: Run E2E or document blocker**

Run: `pnpm test:e2e`

Expected: PASS. If blocked by local dev server lifecycle, record the exact timeout and use the manual Chrome/Edge checklist before proceeding.

## Implementation Notes

- Do not rewrite `SpeechTranslateClient`, `TranscriptStore`, or `SpeechTranslationController` unless a test proves an extension-specific issue.
- Keep `MicrophoneAudioSource` for the website demo; add `TabAudioSource` rather than replacing the interface.
- Avoid keeping session state only in MV3 Service Worker globals. Treat the Offscreen Document as the long-running audio/session owner.
- Use Chinese UI copy and Chinese error messages.
- Do not add history, IndexedDB, export, AI 翻译官, LLM, or Live2D in this migration.
- Chrome and Edge should share one Manifest V3 package unless a browser-specific bug forces a small compatibility branch.
