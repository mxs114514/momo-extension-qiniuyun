import { expect, test } from '@playwright/test'

test('首页可以正常渲染', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Get started' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Count is 0' })).toBeVisible()
})
