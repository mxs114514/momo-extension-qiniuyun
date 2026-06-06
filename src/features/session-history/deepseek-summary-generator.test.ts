import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TranslationSentence } from '../speech-translation/types'
import {
  DeepSeekSummaryGenerator,
  parseDeepSeekSummaryConfig,
} from './deepseek-summary-generator'

const fetchMock = vi.fn()

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('parseDeepSeekSummaryConfig', () => {
  it('未配置 DeepSeek API Key 时禁用远程摘要', () => {
    expect(parseDeepSeekSummaryConfig({ VITE_DEEPSEEK_API_KEY: '' })).toEqual({
      enabled: false,
      apiKey: '',
      model: 'deepseek-v4-flash',
    })
  })

  it('读取 DeepSeek API Key 和模型配置', () => {
    expect(
      parseDeepSeekSummaryConfig({
        VITE_DEEPSEEK_API_KEY: ' sk-test ',
        VITE_DEEPSEEK_MODEL: ' deepseek-v4-pro ',
      }),
    ).toEqual({
      enabled: true,
      apiKey: 'sk-test',
      model: 'deepseek-v4-pro',
    })
  })
})

describe('DeepSeekSummaryGenerator', () => {
  it('按 DeepSeek Chat Completions 格式请求中文摘要', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content: '  关于课程核心观点的摘要  ',
            },
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const generator = new DeepSeekSummaryGenerator({
      apiKey: 'sk-test',
      model: 'deepseek-v4-flash',
    })

    await expect(
      generator.generateSummary([
        makeSentence('1', '第一句中文'),
        makeSentence('2', '第二句中文'),
      ]),
    ).resolves.toBe('关于课程核心观点的摘要')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      model: 'deepseek-v4-flash',
      thinking: { type: 'disabled' },
      temperature: 0.2,
      max_tokens: 120,
      stream: false,
    })
    expect(body.messages[0].content).toContain('不超过 60 个汉字')
    expect(body.messages[1].content).toContain('第一句中文\n第二句中文')
  })

  it('默认 fetcher 不会破坏浏览器原生 fetch 的 this 绑定', async () => {
    const boundFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation')
      }

      return Promise.resolve(
        jsonResponse({
          choices: [{ message: { content: '绑定正常的摘要' } }],
        }),
      )
    })
    vi.stubGlobal('fetch', boundFetch)
    const generator = new DeepSeekSummaryGenerator({
      apiKey: 'sk-test',
      model: 'deepseek-v4-flash',
    })

    await expect(
      generator.generateSummary([makeSentence('1', '你好')]),
    ).resolves.toBe('绑定正常的摘要')
  })

  it('最多只发送前 20 条有效中文译文', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: '摘要' } }],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const generator = new DeepSeekSummaryGenerator({
      apiKey: 'sk-test',
      model: 'deepseek-v4-flash',
    })

    await generator.generateSummary(
      Array.from({ length: 25 }, (_, index) =>
        makeSentence(String(index), `第 ${index + 1} 句`),
      ),
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[1].content).toContain('第 20 句')
    expect(body.messages[1].content).not.toContain('第 21 句')
  })

  it('HTTP 异常、响应结构异常或空摘要时抛错交给上层回退', async () => {
    vi.stubGlobal('fetch', fetchMock)
    const generator = new DeepSeekSummaryGenerator({
      apiKey: 'sk-test',
      model: 'deepseek-v4-flash',
    })

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500))
    await expect(
      generator.generateSummary([makeSentence('1', '你好')]),
    ).rejects.toThrow('DeepSeek 摘要生成失败')

    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [] }))
    await expect(
      generator.generateSummary([makeSentence('1', '你好')]),
    ).rejects.toThrow('DeepSeek 返回摘要为空')

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: '   ' } }] }),
    )
    await expect(
      generator.generateSummary([makeSentence('1', '你好')]),
    ).rejects.toThrow('DeepSeek 返回摘要为空')
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeSentence(id: string, targetText: string): TranslationSentence {
  return {
    id,
    sourceText: '',
    targetText,
    startTime: 0,
    endTime: 1,
    isFinal: true,
  }
}
