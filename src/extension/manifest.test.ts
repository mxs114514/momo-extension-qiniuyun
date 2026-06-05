import { describe, expect, it } from 'vitest'
import manifest from '../../public/manifest.json'

describe('extension manifest', () => {
  it('uses Manifest V3 and declares required extension surfaces', () => {
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.action.default_popup).toBe('popup.html')
    expect(manifest.side_panel.default_path).toBe('side-panel.html')
    expect(manifest.background.service_worker).toBe('assets/background.js')
  })

  it('declares only the permissions needed for tab audio translation', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining([
        'activeTab',
        'tabCapture',
        'offscreen',
        'sidePanel',
        'tabs',
      ]),
    )
    expect(manifest.host_permissions).toContain('wss://asr.cloud.tencent.com/*')
    expect(manifest.host_permissions).toContain('<all_urls>')
  })

  it('declares the content script overlay bundle', () => {
    expect(manifest.content_scripts).toEqual([
      {
        matches: ['<all_urls>'],
        js: ['assets/contentScript.js'],
      },
    ])
  })
})
