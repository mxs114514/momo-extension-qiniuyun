import { chromium, expect, test } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import path from 'node:path'

async function startFixtureServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><html><body><h1>字幕测试页</h1></body></html>')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('测试服务器启动失败')
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}/`,
  }
}

test('浏览器插件构建产物可以加载主要页面和内容脚本', async ({
  page,
}, testInfo) => {
  void page
  const extensionPath = path.resolve('dist')
  const userDataDir = testInfo.outputPath('extension-user-data')
  const fixture = await startFixtureServer()
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })

  try {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(serviceWorker.url()).host

    const popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(
      popup.getByRole('heading', { name: '莫莫实时字幕' }),
    ).toBeVisible()

    const sidePanel = await context.newPage()
    await sidePanel.goto(`chrome-extension://${extensionId}/side-panel.html`)
    await expect(
      sidePanel.getByRole('heading', { name: '莫莫实时字幕' }),
    ).toBeVisible()

    const page = await context.newPage()
    await page.goto(fixture.url)
    await page.waitForLoadState('networkidle')
    await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({})
      const targetTab = tabs.find((tab) => tab.url?.startsWith('http://'))
      if (!targetTab?.id) throw new Error('未找到内容脚本测试页面')

      await chrome.tabs.sendMessage(targetTab.id, {
        type: 'speech/snapshot',
        snapshot: {
          status: 'translating',
          error: null,
          sentences: [
            {
              id: '1',
              sourceText: 'hello',
              targetText: '你好',
              startTime: 0,
              endTime: 1,
              isFinal: false,
            },
          ],
        },
      })
    })
    await expect(page.locator('[data-momo-caption-overlay]')).toHaveText('你好')
  } finally {
    await Promise.all(context.pages().map((page) => page.close()))
    await context.close()
    await new Promise<void>((resolve, reject) => {
      fixture.server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
})
