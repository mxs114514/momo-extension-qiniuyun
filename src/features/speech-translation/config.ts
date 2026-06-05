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

  if (!/^\d+$/.test(appId)) {
    throw new Error('腾讯云 AppID 必须是纯数字，请检查 .env.local')
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
