import { expect, test } from '@playwright/test'

test('实时英译中首页可以正常渲染', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '实时英译中' })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始翻译' })).toBeVisible()
  await expect(page.getByText(/禁止部署或公开发布/)).toBeVisible()
})
