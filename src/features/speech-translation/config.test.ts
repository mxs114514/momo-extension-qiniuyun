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

  it('AppID 不是纯数字时返回中文错误', () => {
    expect(() =>
      parseTencentSpeechConfig({
        VITE_TENCENT_APP_ID: 'not-number',
        VITE_TENCENT_SECRET_ID: 'AKID-example',
        VITE_TENCENT_SECRET_KEY: 'key',
        PROD: false,
      }),
    ).toThrow('腾讯云 AppID 必须是纯数字')
  })

  it('返回固定的英译中配置', () => {
    expect(
      parseTencentSpeechConfig({
        VITE_TENCENT_APP_ID: ' 123 ',
        VITE_TENCENT_SECRET_ID: ' id ',
        VITE_TENCENT_SECRET_KEY: ' key ',
        PROD: false,
      }),
    ).toEqual({
      appId: '123',
      secretId: 'id',
      secretKey: 'key',
      source: 'en',
      target: 'zh',
      voiceFormat: 1,
      translationModel: 'hunyuan-translation-lite',
    })
  })
})
