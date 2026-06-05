# 腾讯云实时语音翻译接入设计

## 1. 目标

在当前 Vite + React + TypeScript 项目中完成一期实时语音翻译能力：

- 运行形态为普通 Vite 网页。
- 音频来源为用户麦克风。
- 源语言固定为英语，目标语言固定为中文。
- 浏览器直接连接腾讯云实时语音翻译 WebSocket。
- 同时保留英语原文和中文译文，界面一期只展示中文。
- 停止翻译或页面卸载时完整释放麦克风、音频节点和 WebSocket。
- 音频来源通过接口隔离，为后续浏览器标签页音频预留扩展位置。

一期不包含 Chrome 扩展改造、标签页音频、历史记录、导出、服务端代理、TTS
和 AI 自动纠错。

## 2. 已确认决策

| 项目 | 决策 |
| --- | --- |
| 接口 | 腾讯云实时语音翻译 WebSocket |
| 音频源 | 一期麦克风，后续增加标签页音频 |
| 页面形态 | 普通 Vite 网页 |
| 鉴权 | 一期前端直连，仅用于本地开发和演示 |
| 语言方向 | `source=en`、`target=zh` |
| 翻译模型 | `hunyuan-translation-lite` |
| 展示内容 | 仅展示 `target_text` |
| 内部数据 | 同时保存 `source_text` 和 `target_text` |

## 3. 方案选择

采用“自有音频源 + 自有腾讯云翻译客户端”的组合，不修改
`tencentcloud-speech-sdk-js/asr`。

原因：

1. 仓库中的 JS SDK 面向普通 ASR，连接地址和响应结构与实时语音翻译不同。
2. 直接修改第三方 SDK 会把普通识别、翻译和音频采集耦合在一起。
3. 独立的 `AudioSource` 接口可以让麦克风和未来的标签页音频复用同一个翻译
   客户端。
4. 签名、协议解析、字幕合并均可作为纯 TypeScript 单元独立测试。

## 4. 总体架构

```text
App
└── SpeechTranslationPanel
    └── useSpeechTranslation
        └── SpeechTranslationController
            ├── AudioSource
            │   └── MicrophoneAudioSource
            │       └── AudioWorklet PCM Processor
            ├── TencentSpeechTranslateClient
            │   ├── Signature Builder
            │   └── WebSocket
            └── TranscriptStore
                ├── sentenceOrder
                └── sentencesById
```

### 4.1 `AudioSource`

定义统一音频源协议：

```typescript
export interface AudioSource {
  start(onChunk: (chunk: Int8Array) => void): Promise<void>
  stop(): Promise<void>
}
```

一期实现 `MicrophoneAudioSource`：

- 使用 `navigator.mediaDevices.getUserMedia()` 申请麦克风。
- 使用 `AudioContext` 和 `AudioWorkletNode` 处理音频。
- 将浏览器原始采样率降采样到 16000Hz。
- 转换为 16bit、有符号、小端、单声道 PCM。
- 约每 200ms 输出一个 6400 字节数据包。
- `stop()` 断开节点、停止全部音轨、关闭 `AudioContext` 并撤销 Blob URL。

后续 `TabAudioSource` 只需实现同一接口。

### 4.2 `TencentSpeechTranslateClient`

只负责腾讯云协议，不负责采集音频：

```typescript
export interface SpeechTranslateClient {
  connect(): Promise<void>
  sendAudio(chunk: Int8Array): void
  stop(): void
  close(): void
}
```

职责：

- 生成握手参数和唯一 `voice_id`。
- 按参数名字典序构造签名原文。
- 使用 Web Crypto 执行 HMAC-SHA1，并进行 Base64 和 URL 编码。
- 连接
  `wss://asr.cloud.tencent.com/asr/speech_translate/<appid>`。
- 连接成功后发出 ready 事件。
- 发送二进制 PCM。
- 解析腾讯云 JSON 响应。
- `stop()` 发送 `{"type":"end"}`，等待顶层 `final=1`。
- 协议错误、网络错误和异常关闭统一转为领域错误。

固定握手参数：

```typescript
{
  source: 'en',
  target: 'zh',
  voice_format: 1,
  trans_model: 'hunyuan-translation-lite',
}
```

### 4.3 `TranscriptStore`

腾讯云每次返回的 `source_text` 和 `target_text` 都是当前句截至该时刻的完整
内容，而不是增量片段。

因此使用 `sentence_id` 作为主键：

```typescript
export interface TranslationSentence {
  id: string
  sourceText: string
  targetText: string
  startTime: number
  endTime: number
  isFinal: boolean
}
```

处理规则：

1. 首次看到 `sentence_id` 时创建句子并记录顺序。
2. 后续响应覆盖该句的 `sourceText` 和 `targetText`。
3. `result.sentence_end=true` 时将该句标记为最终状态。
4. 顶层 `final=1` 只表示整个会话结束，不创建字幕。
5. 页面一期只渲染 `targetText`，但 Store 始终保留双语字段。

### 4.4 `SpeechTranslationController`

协调音频源、翻译客户端和字幕状态：

```text
idle
  -> requesting-permission
  -> connecting
  -> translating
  -> stopping
  -> idle
```

任何阶段发生错误都进入 `error`，同时执行幂等资源清理。

启动顺序：

1. 清空上一会话字幕和错误。
2. 申请麦克风并准备音频处理节点。
3. 建立腾讯云 WebSocket。
4. 收到连接成功事件后开始向客户端发送音频包。
5. 持续将翻译响应写入 Store。

停止顺序：

1. 停止音频源，阻止新音频包进入。
2. 向腾讯云发送 `{"type":"end"}`。
3. 等待 `final=1`，然后关闭 WebSocket。
4. 超时未收到完成消息时强制关闭。
5. 状态回到 `idle`，保留当前字幕。

## 5. 配置与安全边界

开发环境使用：

```dotenv
VITE_TENCENT_APP_ID=
VITE_TENCENT_SECRET_ID=
VITE_TENCENT_SECRET_KEY=
```

`.env.local` 已被 `.gitignore` 忽略；仓库只新增不含真实值的 `.env.example`。

必须在页面中展示明确警告：

> 当前为本地演示模式，腾讯云长期密钥会进入浏览器运行环境，禁止部署或公开
> 发布。

配置模块需要：

- 缺少任一凭证时阻止开始，并显示中文错误。
- 在 `import.meta.env.PROD` 下拒绝读取长期密钥，避免误发布。
- 不在日志、错误信息或 UI 中打印 SecretKey 和完整签名 URL。

正式发布前必须替换为服务端代理或经腾讯云实际验证的短期凭证方案。

## 6. UI 设计

一期只提供验证完整链路所需的最小页面：

- 标题：“实时英译中”。
- 状态标签：未开始、请求麦克风、连接中、翻译中、正在停止、异常。
- 主按钮：开始翻译 / 停止翻译。
- 中文字幕区域：按句子顺序显示 `targetText`。
- 当前未完成句使用弱化样式，最终句使用正常样式。
- 无结果时显示引导文案。
- 错误区域显示可操作的中文错误，例如麦克风被拒绝、缺少配置、鉴权失败。
- 开发安全警告固定显示。

英语原文不在一期 UI 展示，但不能从领域模型中删除。

## 7. 错误处理

错误至少分为：

| 类型 | 示例 | 用户提示 |
| --- | --- | --- |
| 配置错误 | 缺少 AppID | 请补充本地腾讯云配置 |
| 权限错误 | `NotAllowedError` | 麦克风权限被拒绝 |
| 设备错误 | 无麦克风 | 未找到可用麦克风 |
| 浏览器能力 | 不支持 AudioWorklet | 当前浏览器不支持实时音频处理 |
| 鉴权错误 | 腾讯云 `6002` | 腾讯云鉴权失败，请检查密钥 |
| 服务错误 | `6003`、`6004` 等 | 按错误码给出中文说明 |
| 网络错误 | WebSocket 异常关闭 | 网络连接中断，请重试 |
| 超时错误 | 停止后无 `final=1` | 翻译结束超时，连接已关闭 |

清理逻辑必须幂等，重复点击停止、React 卸载和错误回调并发发生时不能抛出
二次错误。

## 8. 测试策略

项目当前只有 Playwright E2E，没有单元测试环境。接入时增加 Vitest 和
Testing Library。

### 单元测试

- PCM 转换：采样率、16bit 小端、边界裁剪、6400 字节分包。
- 签名：参数排序、签名原文、Base64、URL 编码。
- 协议解析：错误响应、句子响应、会话完成响应。
- Transcript Store：同一句全量覆盖、句子排序、最终状态、双语字段保留。
- Controller：启动顺序、只在 ready 后发送音频、停止顺序、错误清理、幂等。

### 组件测试

- 不展示英语原文。
- 中文中间结果会被覆盖。
- 最终中文句子保留。
- 状态和按钮随流程变化。
- 配置缺失和麦克风错误可见。

### E2E

Playwright 不连接真实腾讯云，也不依赖真实麦克风：

- 注入假的 Controller 或浏览器适配器。
- 验证开始、翻译中、字幕更新、停止和异常状态。
- 真实腾讯云联调作为手工验收，不进入自动化测试。

## 9. 手工验收

1. 在 `.env.local` 填入专用测试账号凭证。
2. 使用 Chrome 打开 `http://127.0.0.1:5173`。
3. 点击开始并允许麦克风权限。
4. 连续说英文，页面在数秒内显示中文。
5. 同一句翻译变化时，旧中间结果被覆盖而非重复拼接。
6. 内部调试状态能观察到英语原文和中文译文均被保存。
7. 点击停止后收到最后一句，麦克风指示消失。
8. 拒绝麦克风权限时页面进入异常状态并可重试。
9. 不存在任何真实凭证被 Git 跟踪或输出到控制台。

## 10. 官方协议依据

- 实时语音翻译 WebSocket：
  <https://cloud.tencent.com/document/product/1093/127565>
- 同声传译接入实践：
  <https://cloud.tencent.com/document/product/1093/130882>

协议核对日期：2026-06-05。

