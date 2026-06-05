# 腾讯云 ASR 接入分析与调用指南

## 1. 结论

当前目录 `tencentcloud-speech-sdk-js/asr` 提供的是腾讯云“实时语音识别
（WebSocket）”浏览器 SDK，适合边录音边返回文字。

在本项目中，最简单的调用方式是使用：

```text
WebAudioSpeechRecognizer
  -> WebRecorder 获取麦克风
  -> 转换为 16kHz、16bit、单声道 PCM
  -> SpeechRecognizer 建立腾讯云 WebSocket
  -> 通过回调返回临时结果和最终结果
```

本地验证可以直接使用 SDK 的 `WebAudioSpeechRecognizer`。生产环境不得把长期
`SecretKey` 写入 React 代码、Vite 环境变量或浏览器扩展包中。

## 2. 目录分析

| 文件 | 作用 |
| --- | --- |
| `asr/app/index.js` | 导出 `SpeechRecognizer` 和 `WebAudioSpeechRecognizer` |
| `asr/app/webrecorder.js` | 获取麦克风，降采样并转换为 PCM |
| `asr/app/speechrecognizer.js` | 生成签名、连接 WebSocket、收发识别数据 |
| `asr/app/webaudiospeechrecognizer.js` | 组合录音和识别，通常优先使用 |
| `asr/dist/speechrecognizer.es.js` | 可供 Vite 使用的 ESM 构建产物 |
| `asr/examples/index.js` | 内置录音的完整示例 |
| `asr/examples/main.js` | 手动组合 `WebRecorder` 和 `SpeechRecognizer` 的示例 |

两个主要入口：

1. `WebAudioSpeechRecognizer`
   - SDK 自动申请麦克风权限。
   - SDK 自动把音频转换为腾讯云需要的 PCM。
   - 适合普通网页、扩展弹窗或扩展页面中的实时语音输入。
2. `SpeechRecognizer`
   - 只负责腾讯云 WebSocket。
   - 调用方需要持续通过 `write(data)` 提供音频数据。
   - 适合已有 `MediaStreamTrack`、TRTC 音轨或自定义音频采集逻辑的场景。

## 3. 调用前准备

1. 在腾讯云控制台开通语音识别服务。
2. 获取账号的 `AppID`、`SecretID` 和 `SecretKey`。
3. 确保页面运行在安全上下文：
   - 开发环境使用 `http://localhost`。
   - 正式网页使用 HTTPS。
   - 浏览器扩展应在可访问麦克风的扩展页面中调用，不能在 service worker
     中直接录音。
4. 用户必须主动触发开始录音，例如点击“开始识别”按钮。

SDK 内置录音输出为：

- 采样率：16000Hz
- 采样精度：16bit
- 声道：单声道
- 格式：PCM，对应 `voice_format: 1`

因此默认引擎应使用 `16k_zh`，不要直接沿用示例中的测试值
`16k_zh_test`。

## 4. 本地验证方式

### 4.1 直接运行 SDK 示例

先临时填写：

```javascript
// tencentcloud-speech-sdk-js/asr/examples/config.js
let config = {
  secretKey: '你的 SecretKey',
  secretId: '你的 SecretID',
  appId: 你的AppID,
}
```

然后运行：

```powershell
cd tencentcloud-speech-sdk-js/asr
pnpm exec http-server -p 3000
```

打开：

```text
http://localhost:3000/examples/index.html
```

该方式只用于本机验证。验证完毕应立即删除密钥，且不要提交
`examples/config.js` 中的真实值。

### 4.2 在当前 Vite 项目中引用

当前 SDK 不是标准 npm 依赖，也没有 TypeScript 类型声明。可以先从本地 ESM
构建产物导入：

```typescript
import { WebAudioSpeechRecognizer } from '../../tencentcloud-speech-sdk-js/asr/dist/speechrecognizer.es.js'
```

实际相对路径需要根据调用文件所在目录调整。后续正式接入时，建议将 SDK
作为受控的本地依赖或 vendor 模块管理，不要长期从 `src` 跨目录引用。

## 5. React + TypeScript 调用骨架

下面代码展示 SDK 的核心使用方式。凭证获取部分只定义接口，不应在前端保存
长期密钥。

```typescript
type AsrCredential = {
  appId: number
  secretId: string
  secretKey: string
  token?: string
}

type AsrResult = {
  code: number
  message?: string
  final?: number
  result?: {
    slice_type: 0 | 1 | 2
    index: number
    voice_text_str: string
    start_time?: number
    end_time?: number
  }
}

type TencentRecognizer = {
  start: () => void
  stop: () => void
  destroyStream: () => void
  OnRecognitionStart: (response: AsrResult) => void
  OnSentenceBegin: (response: AsrResult) => void
  OnRecognitionResultChange: (response: AsrResult) => void
  OnSentenceEnd: (response: AsrResult) => void
  OnRecognitionComplete: (response: AsrResult) => void
  OnError: (error: unknown) => void
}

type RecognizerConstructor = new (
  params: Record<string, unknown>,
  isLog?: boolean,
) => TencentRecognizer

// SDK 当前没有 .d.ts，临时做类型收窄。
import {
  WebAudioSpeechRecognizer as RawWebAudioSpeechRecognizer,
} from '../../tencentcloud-speech-sdk-js/asr/dist/speechrecognizer.es.js'

const WebAudioSpeechRecognizer =
  RawWebAudioSpeechRecognizer as RecognizerConstructor

let recognizer: TencentRecognizer | null = null
let confirmedText = ''

export async function startAsr(
  credential: AsrCredential,
  onTextChange: (text: string) => void,
  onError: (error: unknown) => void,
) {
  confirmedText = ''

  recognizer = new WebAudioSpeechRecognizer(
    {
      appid: credential.appId,
      secretid: credential.secretId,
      secretkey: credential.secretKey,
      token: credential.token,
      engine_model_type: '16k_zh',
      voice_format: 1,
      needvad: 1,
      vad_silence_time: 1000,
      filter_dirty: 0,
      filter_modal: 0,
      filter_punc: 0,
      convert_num_mode: 1,
    },
    import.meta.env.DEV,
  )

  recognizer.OnRecognitionStart = () => {
    console.log('腾讯云 ASR 连接成功')
  }

  recognizer.OnRecognitionResultChange = (response) => {
    const changingText = response.result?.voice_text_str ?? ''
    onTextChange(confirmedText + changingText)
  }

  recognizer.OnSentenceEnd = (response) => {
    confirmedText += response.result?.voice_text_str ?? ''
    onTextChange(confirmedText)
  }

  recognizer.OnRecognitionComplete = () => {
    console.log('腾讯云 ASR 识别结束')
  }

  recognizer.OnError = (error) => {
    console.error('腾讯云 ASR 识别失败', error)
    onError(error)
  }

  recognizer.start()
}

export function stopAsr() {
  if (!recognizer) {
    return
  }

  recognizer.stop()
  recognizer.destroyStream()
  recognizer = null
}
```

React 组件中需要注意：

```typescript
useEffect(() => {
  return () => {
    stopAsr()
  }
}, [])
```

组件卸载时必须停止音轨，否则浏览器仍可能显示麦克风正在使用。

## 6. 如何正确拼接识别结果

主要结果位于：

```typescript
response.result.voice_text_str
```

`slice_type` 的含义：

| 值 | 含义 | 处理方式 |
| --- | --- | --- |
| `0` | 一句话开始 | 通常不追加文本 |
| `1` | 非稳态中间结果 | 只用于界面预览，不要永久追加 |
| `2` | 稳态最终句子 | 追加到已确认文本 |

不能在 `OnRecognitionResultChange` 中不断执行 `result += text`，因为中间结果会
被后续结果替换。正确做法是维护：

```text
界面文本 = 已确认文本 + 当前非稳态文本
```

只在 `OnSentenceEnd` 中把结果加入已确认文本。

## 7. 关键参数建议

```typescript
{
  engine_model_type: '16k_zh',
  voice_format: 1,
  needvad: 1,
  vad_silence_time: 1000,
  filter_dirty: 0,
  filter_modal: 0,
  filter_punc: 0,
  convert_num_mode: 1,
  word_info: 0,
}
```

- `engine_model_type`：普通中文麦克风场景使用 `16k_zh`。
- `needvad`：建议长时间录音时开启。
- `vad_silence_time`：静音断句阈值，官方范围为 500 至 2000ms。
- `filter_punc: 0`：保留句末标点。
- `convert_num_mode: 1`：根据语境转换阿拉伯数字。
- `word_info`：需要词级时间戳时再设置为 `1` 或 `2`。
- `hotword_list`：可传临时热词，例如
  `腾讯云|10,语音识别|8,Momo|8`。

## 8. 凭证与生产安全

### 禁止的做法

以下方式都会把长期密钥打包到浏览器中：

```typescript
const secretKey = import.meta.env.VITE_TENCENT_SECRET_KEY
```

`VITE_` 变量不是服务端秘密，构建后任何用户都能读取。浏览器扩展包也可以被
下载和解压，因此不能依赖扩展包隐藏密钥。

### 推荐架构

生产环境优先采用后端代理：

```text
浏览器采集音频
  -> 你自己的后端 WebSocket
  -> 后端使用长期密钥连接腾讯云 ASR
  -> 后端把识别结果转发给浏览器
```

这样长期 `SecretKey` 只存在于服务端，还可以统一实现用户鉴权、限流、配额、
审计和异常重试。

本地 SDK README 还描述了临时凭证方案，即把 STS 返回的
`TmpSecretId`、`TmpSecretKey`、`Token` 分别作为 `secretid`、`secretkey`、
`token` 传入。但是截至 2026-06-05，腾讯云实时语音识别 WebSocket 官方参数
表没有列出 `token`。采用该方案前必须使用当前账号实际验证，不能只依据仓库
README 假定可用。

另外，当前 SDK 的 `signCallback` 是同步函数，不能直接异步请求后端签名接口：

```javascript
signature = params.signCallback(queryStr)
```

如果希望由后端生成签名 URL，需要修改 SDK 以支持异步签名或自行封装
WebSocket 连接；不能简单传入一个返回 `Promise` 的回调。

## 9. SDK 实现中的注意事项

1. `stop()` 发送 `{ "type": "end" }`，等待腾讯云返回最终识别结果。
2. `destroyStream()` 才会停止麦克风的 `MediaStreamTrack`。
3. 当前 `WebAudioSpeechRecognizer.stop()` 不会自动调用
   `destroyStream()`，业务代码应同时调用。
4. SDK 会请求 `https://asr.cloud.tencent.com/server_time` 获取服务端时间。
5. SDK 默认把签名有效期设置为 24 小时。
6. SDK 没有 TypeScript 类型声明，需要自行增加 `.d.ts` 或包装适配层。
7. `app/speechrecognizer.js` 直接依赖浏览器全局对象，不适合 SSR 或 Node.js
   环境。
8. 腾讯云建议以 1:1 实时速率发送音频；发送过快或数据包间隔超过 6 秒可能被
   服务端断开。

## 10. 常见错误排查

### 无法弹出麦克风权限

- 确认调用发生在用户点击事件之后。
- 确认使用 HTTPS、localhost 或扩展页面。
- 检查浏览器是否已永久拒绝该站点的麦克风权限。

### 提示鉴权失败

- 检查 `AppID`、`SecretID`、`SecretKey` 是否属于同一账号。
- 检查 ASR 服务是否已经开通。
- 检查本机时间和腾讯云服务端时间是否异常。
- 不要把 `appid` 写成字符串之外的错误值或遗漏。

### 有中间文字但最终文字重复

不要累计 `OnRecognitionResultChange` 的内容，只累计
`OnSentenceEnd` 的稳态结果。

### 点击停止后麦克风仍亮着

停止时同时调用：

```typescript
recognizer.stop()
recognizer.destroyStream()
```

## 11. 建议的项目落地顺序

1. 先运行 `asr/examples/index.html`，验证腾讯云账号和本机麦克风。
2. 在 React 中封装一个独立的 `TencentAsrClient`，隔离无类型的 JS SDK。
3. 为结果拼接逻辑编写单元测试，覆盖多次 `slice_type: 1` 和最终
   `slice_type: 2`。
4. 开发环境可以用受限制的测试账号快速联调，但不要提交密钥。
5. 正式环境改为后端代理或经实际验证的短期凭证方案。
6. 最后接入 UI，并在组件卸载和异常回调中统一释放麦克风。

## 12. 参考资料

- 腾讯云实时语音识别 WebSocket：
  <https://cloud.tencent.com/document/product/1093/48982>
- 腾讯云 STS 获取联合身份临时访问凭证：
  <https://cloud.tencent.com/document/product/1312/48195>
- 本地 SDK 说明：
  `tencentcloud-speech-sdk-js/asr/README.md`
- 本地完整示例：
  `tencentcloud-speech-sdk-js/asr/examples/index.js`

