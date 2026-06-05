# Tencent Speech Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在普通 Vite 网页中通过麦克风接入腾讯云实时语音翻译，内部保存英文
原文和中文译文，页面一期只展示中文。

**Architecture:** 使用 `AudioSource` 隔离音频来源，
`MicrophoneAudioSource` 输出 16kHz/16bit/单声道 PCM，
`TencentSpeechTranslateClient` 负责签名与 WebSocket 协议，
`SpeechTranslationController` 负责开始、暂停、恢复、停止状态与资源生命周期。字幕按
`sentence_id` 覆盖更新，React 通过订阅 Controller 快照渲染。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Web Audio API、
AudioWorklet、Web Crypto API、WebSocket、Vitest、Testing Library、
Playwright、Tailwind CSS 4、pnpm。

**Tech stack reference:** `doc/技术栈.md`

**Implementation guidance:** `doc/技术实施指南.md`

---

## File Map

### 配置与测试基础

- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `.env.example`
- Create: `src/test/setup.ts`
- Modify: `tests/e2e/app.spec.ts`

### 领域与协议

- Create: `src/features/speech-translation/types.ts`
- Create: `src/features/speech-translation/config.ts`
- Create: `src/features/speech-translation/config.test.ts`
- Create: `src/features/speech-translation/transcript-store.ts`
- Create: `src/features/speech-translation/transcript-store.test.ts`

### 腾讯云客户端

- Create: `src/features/speech-translation/client/signature.ts`
- Create: `src/features/speech-translation/client/signature.test.ts`
- Create:
  `src/features/speech-translation/client/tencent-speech-translate-client.ts`
- Create:
  `src/features/speech-translation/client/tencent-speech-translate-client.test.ts`

### 音频采集

- Create: `src/features/speech-translation/audio/audio-source.ts`
- Create: `src/features/speech-translation/audio/pcm.ts`
- Create: `src/features/speech-translation/audio/pcm.test.ts`
- Create: `src/features/speech-translation/audio/audio-worklet-code.ts`
- Create:
  `src/features/speech-translation/audio/microphone-audio-source.ts`
- Create:
  `src/features/speech-translation/audio/microphone-audio-source.test.ts`

### 流程协调与 React

- Create: `src/features/speech-translation/speech-translation-controller.ts`
- Create:
  `src/features/speech-translation/speech-translation-controller.test.ts`
- Create: `src/features/speech-translation/create-speech-translation.ts`
- Create: `src/features/speech-translation/use-speech-translation.ts`
- Create:
  `src/features/speech-translation/use-speech-translation.test.tsx`
- Create: `src/features/speech-translation/SpeechTranslationPanel.tsx`
- Create:
  `src/features/speech-translation/SpeechTranslationPanel.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

## Task 1: 建立单元与组件测试环境

**Files:**

- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: 安装测试依赖**

Run:

```powershell
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package.json` 和 `pnpm-lock.yaml` 更新，命令退出码为 0。

- [ ] **Step 2: 添加测试脚本**

在 `package.json` 中加入：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run",
    "check": "pnpm typecheck && pnpm lint && pnpm stylelint && pnpm format && pnpm test:unit && pnpm test:e2e"
  }
}
```

- [ ] **Step 3: 配置 Vitest**

更新 `vite.config.ts`：

```typescript
/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
```

创建 `src/test/setup.ts`：

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: 运行空测试集**

Run:

```powershell
pnpm test:unit --passWithNoTests
```

Expected: PASS，Vitest 可正常启动。

- [ ] **Step 5: 运行现有质量检查**

Run:

```powershell
pnpm typecheck
pnpm lint
```

Expected: 两条命令均退出码为 0。

## Task 2: 定义领域类型与开发配置边界

**Files:**

- Create: `.env.example`
- Create: `src/features/speech-translation/types.ts`
- Create: `src/features/speech-translation/config.ts`
- Create: `src/features/speech-translation/config.test.ts`

- [ ] **Step 1: 为配置解析编写失败测试**

`config.test.ts` 至少覆盖：

```typescript
import { describe, expect, it } from 'vitest'
import { parseTencentSpeechConfig } from './config'

describe('parseTencentSpeechConfig', () => {
  it('缺少凭证时返回中文错误', () => {
    expect(() =>
      parseTencentSpeechConfig({
        VITE_TENCENT_APP_ID: '',
        VITE_TENCENT_SECRET_ID: '',
        VITE_TENCENT_SECRET_KEY: '',
        PROD: false,
      }),
    ).toThrow('请在 .env.local 中配置腾讯云凭证')
  })

  it('生产环境拒绝使用长期密钥', () => {
    expect(() =>
      parseTencentSpeechConfig({
        VITE_TENCENT_APP_ID: '123',
        VITE_TENCENT_SECRET_ID: 'id',
        VITE_TENCENT_SECRET_KEY: 'key',
        PROD: true,
      }),
    ).toThrow('生产环境禁止使用前端长期密钥')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/config.test.ts
```

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 定义领域类型**

`types.ts` 应包含：

```typescript
export type TranslationStatus =
  | 'idle'
  | 'requesting-permission'
  | 'connecting'
  | 'translating'
  | 'paused'
  | 'stopping'
  | 'error'

export interface TranslationSentence {
  id: string
  sourceText: string
  targetText: string
  startTime: number
  endTime: number
  isFinal: boolean
}

export interface SpeechTranslationSnapshot {
  status: TranslationStatus
  sentences: TranslationSentence[]
  error: string | null
}

export interface TencentSpeechConfig {
  appId: string
  secretId: string
  secretKey: string
  source: 'en'
  target: 'zh'
  voiceFormat: 1
  translationModel: 'hunyuan-translation-lite'
}
```

- [ ] **Step 4: 实现配置解析**

`config.ts`：

```typescript
import type { TencentSpeechConfig } from './types'

type Environment = Record<string, string | boolean | undefined>

export function parseTencentSpeechConfig(
  environment: Environment,
): TencentSpeechConfig {
  if (environment.PROD) {
    throw new Error('生产环境禁止使用前端长期密钥')
  }

  const appId = String(environment.VITE_TENCENT_APP_ID ?? '').trim()
  const secretId = String(environment.VITE_TENCENT_SECRET_ID ?? '').trim()
  const secretKey = String(environment.VITE_TENCENT_SECRET_KEY ?? '').trim()

  if (!appId || !secretId || !secretKey) {
    throw new Error('请在 .env.local 中配置腾讯云凭证')
  }

  return {
    appId,
    secretId,
    secretKey,
    source: 'en',
    target: 'zh',
    voiceFormat: 1,
    translationModel: 'hunyuan-translation-lite',
  }
}
```

`.env.example`：

```dotenv
# 仅用于本地开发演示，禁止配置生产账号或提交真实值。
VITE_TENCENT_APP_ID=
VITE_TENCENT_SECRET_ID=
VITE_TENCENT_SECRET_KEY=
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
pnpm vitest run src/features/speech-translation/config.test.ts
```

Expected: PASS。

## Task 3: 实现双语字幕 Store

**Files:**

- Create: `src/features/speech-translation/transcript-store.ts`
- Create: `src/features/speech-translation/transcript-store.test.ts`

- [ ] **Step 1: 编写句子覆盖测试**

```typescript
import { describe, expect, it } from 'vitest'
import { TranscriptStore } from './transcript-store'

describe('TranscriptStore', () => {
  it('按 sentence_id 覆盖当前句并保留双语文本', () => {
    const store = new TranscriptStore()

    store.update({
      sentenceId: '1',
      sourceText: 'Welcome',
      targetText: '欢迎',
      startTime: 0,
      endTime: 200,
      sentenceEnd: false,
    })
    store.update({
      sentenceId: '1',
      sourceText: 'Welcome everyone',
      targetText: '欢迎大家',
      startTime: 0,
      endTime: 500,
      sentenceEnd: true,
    })

    expect(store.getSentences()).toEqual([
      {
        id: '1',
        sourceText: 'Welcome everyone',
        targetText: '欢迎大家',
        startTime: 0,
        endTime: 500,
        isFinal: true,
      },
    ])
  })

  it('保持句子首次出现的顺序', () => {
    const store = new TranscriptStore()
    // 依次写入 2、1，再更新 2，期望顺序仍为 2、1。
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/transcript-store.test.ts
```

Expected: FAIL，Store 尚不存在。

- [ ] **Step 3: 实现 Store**

实现以下公开 API：

```typescript
export interface TranslationUpdate {
  sentenceId: string
  sourceText: string
  targetText: string
  startTime: number
  endTime: number
  sentenceEnd: boolean
}

export class TranscriptStore {
  update(update: TranslationUpdate): void
  clear(): void
  getSentences(): TranslationSentence[]
}
```

约束：

- 用 `Map<string, TranslationSentence>` 保存句子。
- 用数组保存首次出现顺序。
- `getSentences()` 返回新的数组和句子副本，禁止调用方修改内部状态。
- 同一句更新时覆盖完整文本，不能字符串追加。

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
pnpm vitest run src/features/speech-translation/transcript-store.test.ts
```

Expected: PASS。

## Task 4: 实现腾讯云签名构造

**Files:**

- Create: `src/features/speech-translation/client/signature.ts`
- Create: `src/features/speech-translation/client/signature.test.ts`

- [ ] **Step 1: 编写确定性签名测试**

测试必须注入固定时间和 `voiceId`，覆盖：

- 参数按名称字典序排列。
- 签名原文不带 `wss://`。
- WebSocket URL 使用
  `asr.cloud.tencent.com/asr/speech_translate/<appid>`。
- `signature` 经过 URL 编码。
- 不将 `secretKey` 放入查询参数。

示例：

```typescript
const result = await createSpeechTranslateUrl(
  {
    appId: '123456',
    secretId: 'AKID',
    secretKey: 'SECRET',
    source: 'en',
    target: 'zh',
    voiceFormat: 1,
    translationModel: 'hunyuan-translation-lite',
  },
  {
    nowSeconds: 1_700_000_000,
    voiceId: 'voice-1',
  },
)

expect(result.signingText).toContain(
  'asr.cloud.tencent.com/asr/speech_translate/123456?',
)
expect(result.url).toMatch(/^wss:\/\/asr\.cloud\.tencent\.com/)
expect(result.url).not.toContain('SECRET')
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/client/signature.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现签名模块**

公开 API：

```typescript
interface SignatureOverrides {
  nowSeconds?: number
  voiceId?: string
}

export async function createSpeechTranslateUrl(
  config: TencentSpeechConfig,
  overrides?: SignatureOverrides,
): Promise<{ url: string; signingText: string }>
```

实现要求：

1. 构造 `secretid`、`timestamp`、`expired`、`nonce`、`voice_id`、
   `voice_format`、`source`、`target`、`trans_model`。
2. `expired` 为当前时间后 24 小时。
3. 使用 `URLSearchParams` 前先显式排序键，避免依赖隐式顺序。
4. 使用 `crypto.subtle.importKey()` 和 `crypto.subtle.sign()` 完成
   HMAC-SHA1。
5. Base64 编码签名字节，再用 `encodeURIComponent()` 写入 URL。
6. 不记录完整 URL。

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
pnpm vitest run src/features/speech-translation/client/signature.test.ts
```

Expected: PASS。

## Task 5: 实现腾讯云 WebSocket 客户端

**Files:**

- Create:
  `src/features/speech-translation/client/tencent-speech-translate-client.ts`
- Create:
  `src/features/speech-translation/client/tencent-speech-translate-client.test.ts`

- [ ] **Step 1: 编写协议行为测试**

使用可注入的 `WebSocketFactory`，假的 WebSocket 至少记录 `send()` 和
`close()`。

覆盖：

```typescript
it('连接成功后发出 ready')
it('sendAudio 发送 Int8Array 二进制内容')
it('解析 source_text 和 target_text 并发出 sentence')
it('stop 发送 {"type":"end"} 且不立即 close')
it('收到 final=1 后发出 complete 并正常关闭')
it('code 非 0 时发出中文错误并关闭')
it('异常 close 转为网络错误')
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/client/tencent-speech-translate-client.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 定义客户端事件和依赖接口**

```typescript
export interface SpeechTranslateEvents {
  onReady: () => void
  onSentence: (update: TranslationUpdate) => void
  onComplete: () => void
  onError: (message: string) => void
}

export interface SpeechTranslateClient {
  connect(): Promise<void>
  sendAudio(chunk: Int8Array): void
  stop(): void
  close(): void
}
```

构造函数注入：

- `TencentSpeechConfig`
- `SpeechTranslateEvents`
- `WebSocketFactory`
- `createSpeechTranslateUrl`

- [ ] **Step 4: 实现协议解析**

解析器只接受符合预期的响应：

```typescript
type TencentResponse = {
  code: number
  message?: string
  final?: number
  result?: {
    sentence_id: string | number
    source_text: string
    target_text: string
    start_time: number
    end_time: number
    sentence_end: boolean
  }
}
```

处理顺序：

1. JSON 解析失败 -> 协议错误。
2. `code !== 0` -> 映射为中文错误。
3. `final === 1` -> `onComplete()` 后 `close(1000)`。
4. 有 `result` -> 标准化为 `TranslationUpdate`。

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
pnpm vitest run src/features/speech-translation/client/tencent-speech-translate-client.test.ts
```

Expected: PASS。

## Task 6: 实现 PCM 转换与固定分包

**Files:**

- Create: `src/features/speech-translation/audio/pcm.ts`
- Create: `src/features/speech-translation/audio/pcm.test.ts`

- [ ] **Step 1: 编写 PCM 测试**

覆盖：

```typescript
it('将 Float32 样本裁剪并转换为 16bit 小端 PCM')
it('将 48000Hz 输入降采样为 16000Hz')
it('累计数据并只输出 6400 字节完整包')
it('flush 返回剩余数据且清空缓冲区')
```

关键断言：

- `-1` -> `0x8000`
- `0` -> `0x0000`
- `1` -> `0x7fff`
- 48000 个输入样本约产生 16000 个输出样本。
- 输入不足 6400 字节时不发包。

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/audio/pcm.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现纯函数与分包器**

```typescript
export function downsampleTo16k(
  input: Float32Array,
  inputSampleRate: number,
): Float32Array

export function float32ToPcm16(input: Float32Array): Int8Array

export class PcmChunker {
  constructor(private readonly chunkSize = 6400) {}
  push(chunk: Int8Array): Int8Array[]
  flush(): Int8Array | null
  clear(): void
}
```

禁止每个样本使用数组扩展运算符，避免长录音产生大量临时对象。使用
`Uint8Array.set()` 和受控缓冲区拼接。

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
pnpm vitest run src/features/speech-translation/audio/pcm.test.ts
```

Expected: PASS。

## Task 7: 实现麦克风 AudioSource

**Files:**

- Create: `src/features/speech-translation/audio/audio-source.ts`
- Create: `src/features/speech-translation/audio/audio-worklet-code.ts`
- Create:
  `src/features/speech-translation/audio/microphone-audio-source.ts`
- Create:
  `src/features/speech-translation/audio/microphone-audio-source.test.ts`

- [ ] **Step 1: 定义音频源接口**

```typescript
export interface AudioSource {
  start(onChunk: (chunk: Int8Array) => void): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<void>
}
```

- [ ] **Step 2: 编写资源生命周期失败测试**

通过依赖注入模拟 `getUserMedia`、`AudioContext`、节点和音轨，覆盖：

```typescript
it('申请仅音频且开启回声消除')
it('AudioWorklet 样本经过降采样和分包后输出')
it('pause 暂停 AudioContext 并停止输出数据')
it('resume 恢复 AudioContext 和数据输出')
it('stop 断开节点、停止音轨并关闭 AudioContext')
it('重复 stop 不抛错')
it('麦克风拒绝转换为中文错误')
it('不支持 AudioWorklet 时明确失败')
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/audio/microphone-audio-source.test.ts
```

Expected: FAIL。

- [ ] **Step 4: 实现 AudioWorklet 代码**

`audio-worklet-code.ts` 导出字符串。Worklet 只做一件事：将输入声道的
`Float32Array` 复制后通过 `port.postMessage()` 发送给主线程。

主线程负责：

1. `downsampleTo16k()`
2. `float32ToPcm16()`
3. `PcmChunker.push()`
4. 将每个完整 6400 字节包交给 `onChunk`

这样 PCM 算法只存在一份，并能直接单元测试。

- [ ] **Step 5: 实现 `MicrophoneAudioSource`**

构造函数注入浏览器 API 适配器，生产默认值使用真实 API：

```typescript
interface MicrophoneDependencies {
  getUserMedia: typeof navigator.mediaDevices.getUserMedia
  createAudioContext: () => AudioContext
  createObjectURL: typeof URL.createObjectURL
  revokeObjectURL: typeof URL.revokeObjectURL
}
```

`start()`：

- 防止重复启动。
- 请求 `{ audio: { echoCancellation: true }, video: false }`。
- 创建 AudioContext、MediaStreamSource、AudioWorkletNode。
- 注册消息处理后连接节点。

`pause()`：

- 已启动时调用 `audioContext.suspend()`。
- 标记暂停并忽略暂停期间迟到的 Worklet 消息。
- 不停止 `MediaStreamTrack`，不销毁节点。
- 重复调用保持幂等。

`resume()`：

- 已暂停时调用 `audioContext.resume()`。
- 恢复处理 Worklet 消息。
- 重复调用保持幂等。

`stop()`：

- 标记停止，忽略迟到消息。
- 断开节点。
- 停止全部 track。
- `await audioContext.close()`。
- 撤销 Blob URL。
- 清空分包缓存和所有引用。

- [ ] **Step 6: 运行测试确认通过**

Run:

```powershell
pnpm vitest run src/features/speech-translation/audio/microphone-audio-source.test.ts
```

Expected: PASS。

## Task 8: 实现 Controller 状态机

**Files:**

- Create: `src/features/speech-translation/speech-translation-controller.ts`
- Create:
  `src/features/speech-translation/speech-translation-controller.test.ts`

- [ ] **Step 1: 编写启动和停止失败测试**

使用假的 `AudioSource`、客户端和计时器，覆盖：

```typescript
it('start 依次进入请求权限、连接中、翻译中')
it('客户端 ready 前丢弃音频包')
it('ready 后把音频发送给客户端')
it('句子响应写入 Store 并通知订阅者')
it('pause 暂停音频源、停止发送并进入 paused')
it('resume 恢复音频源、继续发送并进入 translating')
it('非 translating 状态不能执行 pause')
it('非 paused 状态不能执行 resume')
it('stop 先停止音频源再请求客户端结束')
it('complete 后回到 idle 并保留字幕')
it('停止超时后强制关闭客户端')
it('错误时清理两侧资源并进入 error')
it('重复 start 和 stop 保持幂等')
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/speech-translation-controller.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现可订阅 Controller**

公开 API：

```typescript
export class SpeechTranslationController {
  getSnapshot(): SpeechTranslationSnapshot
  subscribe(listener: () => void): () => void
  start(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
}
```

实现约束：

- `getSnapshot()` 返回稳定快照；状态变化时替换快照对象。
- `subscribe()` 返回取消订阅函数。
- `start()` 清空字幕后进入 `requesting-permission`。
- 音频源准备后进入 `connecting` 并连接客户端。
- `onReady` 后进入 `translating` 并允许发送音频。
- `pause()` 先禁止发送，再暂停音频源，状态进入 `paused`。
- `resume()` 恢复音频源后允许发送，状态回到 `translating`。
- 暂停期间保留 WebSocket；连接异常关闭时进入 `error` 并提示重新开始。
- `stop()` 先禁止发送，再停止音频源，然后客户端 `stop()`。
- 5 秒没有 `onComplete` 时强制 `close()` 并回到 `idle`。
- 所有清理路径复用一个私有幂等方法。

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
pnpm vitest run src/features/speech-translation/speech-translation-controller.test.ts
```

Expected: PASS。

## Task 9: 创建生产装配与 React Hook

**Files:**

- Create: `src/features/speech-translation/create-speech-translation.ts`
- Create: `src/features/speech-translation/use-speech-translation.ts`
- Create:
  `src/features/speech-translation/use-speech-translation.test.tsx`

- [ ] **Step 1: 编写 Hook 生命周期失败测试**

覆盖：

```typescript
it('通过 useSyncExternalStore 渲染 controller 快照')
it('组件卸载时取消订阅并 dispose')
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/use-speech-translation.test.tsx
```

Expected: FAIL。

- [ ] **Step 3: 实现工厂**

`create-speech-translation.ts`：

```typescript
export function createSpeechTranslationController() {
  const config = parseTencentSpeechConfig(import.meta.env)
  const transcriptStore = new TranscriptStore()
  const audioSource = new MicrophoneAudioSource()

  return new SpeechTranslationController({
    audioSource,
    transcriptStore,
    createClient: (events) =>
      new TencentSpeechTranslateClient(config, events),
  })
}
```

配置解析必须延迟到用户点击开始时或可捕获的工厂调用中，不能因缺少 `.env.local`
导致整个 React 应用白屏。

- [ ] **Step 4: 实现 Hook**

使用 `useSyncExternalStore()` 订阅 Controller。组件卸载时调用
`controller.dispose()`，并捕获清理错误输出中文日志，不向页面抛出未处理
Promise。

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
pnpm vitest run src/features/speech-translation/use-speech-translation.test.tsx
```

Expected: PASS。

## Task 10: 实现中文实时字幕页面

**Files:**

- Create: `src/features/speech-translation/SpeechTranslationPanel.tsx`
- Create:
  `src/features/speech-translation/SpeechTranslationPanel.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/index.css`

- [ ] **Step 1: 编写组件失败测试**

通过注入假的 Controller 覆盖：

```typescript
it('初始状态显示开始翻译')
it('翻译中只显示 targetText，不显示 sourceText')
it('未完成句和最终句均按顺序显示')
it('翻译中显示暂停和停止按钮')
it('暂停状态显示继续和停止按钮')
it('点击开始、暂停、继续和停止调用 controller')
it('异常状态显示中文错误并允许重试')
it('始终显示开发密钥安全警告')
```

关键断言：

```typescript
expect(screen.getByText('欢迎大家')).toBeVisible()
expect(screen.queryByText('Welcome everyone')).not.toBeInTheDocument()
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
pnpm vitest run src/features/speech-translation/SpeechTranslationPanel.test.tsx
```

Expected: FAIL。

- [ ] **Step 3: 实现最小页面**

组件结构：

```text
main
├── header
│   ├── h1 实时英译中
│   └── status
├── security warning
├── controls
│   └── start/pause/resume/stop buttons
├── error alert
└── transcript
    └── target text sentences
```

要求：

- 所有 UI 文案使用中文。
- 不显示或打印英语原文。
- 进行中句子使用 `aria-live="polite"`。
- 状态变化不能导致按钮宽度明显跳动。
- 小屏和桌面均可用，不引入与实时翻译无关的复杂视觉功能。
- 布局、间距、颜色、排版、响应式和交互状态优先使用 Tailwind CSS 4 工具类。
- `src/index.css` 添加 `@import 'tailwindcss';`，只保留全局变量和基础元素样式。
- `src/App.css` 删除 Vite 示例样式，只保留 Tailwind 不适合表达的少量自定义
  样式；如果没有必要则删除该文件及其导入。

- [ ] **Step 4: 替换 Vite 示例页**

`App.tsx` 只负责创建/持有 Controller 并渲染
`SpeechTranslationPanel`。删除 React/Vite 示例计数器和无关资源引用。

- [ ] **Step 5: 运行组件测试**

Run:

```powershell
pnpm vitest run src/features/speech-translation/SpeechTranslationPanel.test.tsx
```

Expected: PASS。

- [ ] **Step 6: 运行单元测试全集**

Run:

```powershell
pnpm test:unit
```

Expected: 全部 PASS。

## Task 11: 更新 E2E 验收

**Files:**

- Modify: `tests/e2e/app.spec.ts`

- [ ] **Step 1: 更新首页 E2E**

自动化 E2E 不读取真实腾讯云凭证，也不连接真实麦克风。测试：

```typescript
test('实时英译中首页可以正常渲染', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: '实时英译中' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '开始翻译' }),
  ).toBeVisible()
  await expect(page.getByText(/禁止部署或公开发布/)).toBeVisible()
})
```

- [ ] **Step 2: 运行 E2E**

Run:

```powershell
pnpm test:e2e
```

Expected: Chromium 项目 PASS。

## Task 12: 全量校验与真实服务手工验收

**Files:**

- Verify only

- [ ] **Step 1: 格式化本次文件**

Run:

```powershell
pnpm exec prettier --write package.json vite.config.ts .env.example src/features src/test tests/e2e/app.spec.ts
```

Expected: 命令退出码为 0，只格式化本次相关文件。

- [ ] **Step 2: 运行完整项目检查**

Run:

```powershell
pnpm check
pnpm build
```

Expected:

- TypeScript 无错误。
- ESLint、Stylelint、Prettier 通过。
- Vitest 全部通过。
- Playwright E2E 通过。
- Vite 构建成功。

- [ ] **Step 3: 检查密钥泄漏**

Run:

```powershell
git status --short
git diff -- . ':!pnpm-lock.yaml'
git grep -n -E "AKID|SecretKey|VITE_TENCENT_SECRET_KEY=" -- ':!doc/*' ':!.env.example'
```

Expected:

- `.env.local` 不出现在 Git 状态中。
- 源码没有真实 `SecretID`、`SecretKey` 或完整签名 URL。
- 保留用户现有的 `commitlint.config.cjs` 修改，不覆盖、不回退。

- [ ] **Step 4: 使用真实腾讯云做手工验收**

创建本地 `.env.local`：

```dotenv
VITE_TENCENT_APP_ID=<测试账号 AppID>
VITE_TENCENT_SECRET_ID=<测试账号 SecretID>
VITE_TENCENT_SECRET_KEY=<测试账号 SecretKey>
```

Run:

```powershell
pnpm dev --host 127.0.0.1
```

手工确认：

1. 点击开始后浏览器请求麦克风权限。
2. 允许权限后状态进入“翻译中”。
3. 说英语时页面只显示中文。
4. 同一句中间结果发生变化时不会重复累加。
5. 点击暂停后状态显示“已暂停”，字幕停止更新，麦克风和 WebSocket 会话保留。
6. 点击继续后恢复同一会话，新的英文语音继续生成中文。
7. 暂停过久导致腾讯云断开时，页面显示异常并允许重新开始。
8. 调试断点可确认 Store 同时保存英文和中文。
9. 点击停止后最终句保留，麦克风指示消失。
10. 拒绝权限、填写错误密钥时页面显示中文错误。
11. 控制台和网络日志之外的应用日志不包含 SecretKey。

- [ ] **Step 5: 记录已知安全限制**

在交付总结中明确：

- 当前前端直连只适合本地演示。
- 任何包含长期密钥的产物都不得部署或分发。
- Chrome 扩展阶段开始前，先切换为后端代理或经过验证的短期凭证。
- 下一阶段新增 `TabAudioSource`，不修改翻译客户端和字幕 Store。
