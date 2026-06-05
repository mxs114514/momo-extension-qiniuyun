import type { TencentSpeechConfig } from '../types'

interface SignatureOverrides {
  nowSeconds?: number
  voiceId?: string
}

const HOST = 'asr.cloud.tencent.com'

function createVoiceId(): string {
  return crypto.randomUUID()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export async function createSpeechTranslateUrl(
  config: TencentSpeechConfig,
  overrides: SignatureOverrides = {},
): Promise<{ url: string; signingText: string }> {
  const nowSeconds = overrides.nowSeconds ?? Math.floor(Date.now() / 1000)
  const path = `/asr/speech_translate/${config.appId}`
  const values: Record<string, string> = {
    expired: String(nowSeconds + 86_400),
    nonce: String(nowSeconds),
    secretid: config.secretId,
    source: config.source,
    target: config.target,
    timestamp: String(nowSeconds),
    trans_model: config.translationModel,
    voice_format: String(config.voiceFormat),
    voice_id: overrides.voiceId ?? createVoiceId(),
  }
  const params = new URLSearchParams()
  for (const key of Object.keys(values).sort()) {
    params.set(key, values[key])
  }

  const signingText = `${HOST}${path}?${params.toString()}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(config.secretKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingText),
  )
  const encodedSignature = encodeURIComponent(
    bytesToBase64(new Uint8Array(signature)),
  )

  return {
    signingText,
    url: `wss://${signingText}&signature=${encodedSignature}`,
  }
}
