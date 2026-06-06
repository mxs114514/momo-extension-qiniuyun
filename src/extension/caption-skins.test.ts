import { describe, expect, it } from 'vitest'
import { CAPTION_SKINS } from './caption-skins'

describe('caption skins', () => {
  it('流萤喜悦皮肤使用紫色系背景遮罩', () => {
    const skin = CAPTION_SKINS.find((skin) => skin.id === 'liuying-joy')

    expect(skin?.imageOverlay).toContain('rgba(88, 28, 135')
    expect(skin?.imageOverlay).toContain('rgba(126, 34, 206')
  })
})
