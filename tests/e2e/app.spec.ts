import { expect, test } from '@playwright/test'
import { createReadStream, existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import path from 'node:path'

async function startStaticServer(): Promise<{ server: Server; url: string }> {
  const distPath = path.resolve('dist')
  const server = createServer((request, response) => {
    const requestPath =
      request.url === '/' ? '/index.html' : (request.url ?? '')
    const filePath = path.join(distPath, requestPath)

    if (!filePath.startsWith(distPath) || !existsSync(filePath)) {
      response.writeHead(404)
      response.end('Not Found')
      return
    }

    response.writeHead(200, { 'Content-Type': contentType(filePath) })
    createReadStream(filePath).pipe(response)
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

function contentType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

test('实时英译中首页可以正常渲染', async ({ page }) => {
  const fixture = await startStaticServer()
  try {
    await page.goto(fixture.url)

    await expect(
      page.getByRole('heading', { name: '莫莫实时字幕' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: '开始翻译' })).toBeVisible()
    await expect(page.getByText(/个人比赛演示/)).toBeVisible()
  } finally {
    await new Promise<void>((resolve, reject) => {
      fixture.server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
})
