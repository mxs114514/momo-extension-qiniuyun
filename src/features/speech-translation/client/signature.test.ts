import { describe, expect, it } from 'vitest'
import { createSpeechTranslateUrl } from './signature'

describe('createSpeechTranslateUrl', () => {
  it('按字典序构造签名原文并生成安全的 WebSocket URL', async () => {
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
      { nowSeconds: 1_700_000_000, voiceId: 'voice-1' },
    )

    expect(result.signingText).toBe(
      'asr.cloud.tencent.com/asr/speech_translate/123456?expired=1700086400&nonce=1700000000&secretid=AKID&source=en&target=zh&timestamp=1700000000&trans_model=hunyuan-translation-lite&voice_format=1&voice_id=voice-1',
    )
    expect(result.url).toMatch(
      /^wss:\/\/asr\.cloud\.tencent\.com\/asr\/speech_translate\/123456\?/,
    )
    expect(result.url).toContain('&signature=')
    expect(result.url).not.toContain('SECRET')
    expect(result.url).not.toContain('wss%3A')
  })
})
