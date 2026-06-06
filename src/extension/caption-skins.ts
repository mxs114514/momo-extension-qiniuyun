export const CAPTION_SKIN_STORAGE_KEY = 'momoCaptionSkin'

export type CaptionSkinId =
  | 'classic-dark'
  | 'classic-light'
  | 'liuying-thinking'
  | 'liuying-surprise'
  | 'liuying-joy'

export interface CaptionSkin {
  id: CaptionSkinId
  label: string
  bubbleBackground: string
  bubbleColor: string
  panelBackground: string
  panelColor: string
  headerColor: string
  titleColor: string
  statusDotColor: string
  overlayColor: string
  errorColor: string
  shadow: string
  actionBackground: string
  actionBorder: string
  actionColor: string
  subtleButtonBackground: string
  subtleButtonColor: string
  backgroundImagePath?: string
  imageOverlay?: string
}

export const DEFAULT_CAPTION_SKIN_ID: CaptionSkinId = 'classic-dark'

export const CAPTION_SKINS: CaptionSkin[] = [
  {
    id: 'classic-dark',
    label: '默认黑色',
    bubbleBackground: 'rgba(17, 24, 39, 0.92)',
    bubbleColor: '#fff',
    panelBackground: 'rgba(0, 0, 0, 0.78)',
    panelColor: '#fff',
    headerColor: '#cbd5e1',
    titleColor: '#fff',
    statusDotColor: '#38bdf8',
    overlayColor: '#fff',
    errorColor: '#fecaca',
    shadow: '0 8px 24px rgba(15, 23, 42, 0.22)',
    actionBackground: 'rgba(56, 189, 248, 0.18)',
    actionBorder: 'rgba(125, 211, 252, 0.7)',
    actionColor: '#e0f2fe',
    subtleButtonBackground: 'rgba(255, 255, 255, 0.14)',
    subtleButtonColor: '#fff',
  },
  {
    id: 'classic-light',
    label: '白色',
    bubbleBackground: 'rgba(255, 255, 255, 0.94)',
    bubbleColor: '#0f172a',
    panelBackground: 'rgba(255, 255, 255, 0.92)',
    panelColor: '#0f172a',
    headerColor: '#475569',
    titleColor: '#0f172a',
    statusDotColor: '#0284c7',
    overlayColor: '#0f172a',
    errorColor: '#b91c1c',
    shadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
    actionBackground: 'rgba(14, 165, 233, 0.12)',
    actionBorder: 'rgba(2, 132, 199, 0.52)',
    actionColor: '#075985',
    subtleButtonBackground: 'rgba(15, 23, 42, 0.08)',
    subtleButtonColor: '#0f172a',
  },
  {
    id: 'liuying-thinking',
    label: '流萤-思考',
    bubbleBackground: 'rgba(30, 64, 175, 0.9)',
    bubbleColor: '#eff6ff',
    panelBackground: 'rgba(15, 23, 42, 0.72)',
    panelColor: '#eff6ff',
    headerColor: '#dbeafe',
    titleColor: '#fff',
    statusDotColor: '#93c5fd',
    overlayColor: '#fff',
    errorColor: '#fecaca',
    shadow: '0 12px 34px rgba(30, 64, 175, 0.26)',
    actionBackground: 'rgba(147, 197, 253, 0.18)',
    actionBorder: 'rgba(191, 219, 254, 0.72)',
    actionColor: '#eff6ff',
    subtleButtonBackground: 'rgba(255, 255, 255, 0.18)',
    subtleButtonColor: '#fff',
    backgroundImagePath: 'skins/liuying-thinking.webp',
    imageOverlay:
      'linear-gradient(90deg, rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.48))',
  },
  {
    id: 'liuying-surprise',
    label: '流萤-惊喜',
    bubbleBackground: 'rgba(190, 24, 93, 0.9)',
    bubbleColor: '#fff1f2',
    panelBackground: 'rgba(80, 7, 36, 0.72)',
    panelColor: '#fff1f2',
    headerColor: '#ffe4e6',
    titleColor: '#fff',
    statusDotColor: '#fda4af',
    overlayColor: '#fff',
    errorColor: '#fecaca',
    shadow: '0 12px 34px rgba(190, 24, 93, 0.25)',
    actionBackground: 'rgba(251, 113, 133, 0.18)',
    actionBorder: 'rgba(253, 164, 175, 0.74)',
    actionColor: '#fff1f2',
    subtleButtonBackground: 'rgba(255, 255, 255, 0.18)',
    subtleButtonColor: '#fff',
    backgroundImagePath: 'skins/liuying-surprise.webp',
    imageOverlay:
      'linear-gradient(90deg, rgba(80, 7, 36, 0.1), rgba(80, 7, 36, 0.46))',
  },
  {
    id: 'liuying-joy',
    label: '流萤-喜悦',
    bubbleBackground: 'rgba(4, 120, 87, 0.9)',
    bubbleColor: '#ecfdf5',
    panelBackground: 'rgba(6, 78, 59, 0.72)',
    panelColor: '#ecfdf5',
    headerColor: '#d1fae5',
    titleColor: '#fff',
    statusDotColor: '#6ee7b7',
    overlayColor: '#fff',
    errorColor: '#fecaca',
    shadow: '0 12px 34px rgba(4, 120, 87, 0.24)',
    actionBackground: 'rgba(110, 231, 183, 0.18)',
    actionBorder: 'rgba(167, 243, 208, 0.74)',
    actionColor: '#ecfdf5',
    subtleButtonBackground: 'rgba(255, 255, 255, 0.18)',
    subtleButtonColor: '#fff',
    backgroundImagePath: 'skins/liuying-joy.webp',
    imageOverlay:
      'linear-gradient(90deg, rgba(6, 78, 59, 0.1), rgba(6, 78, 59, 0.46))',
  },
]

export function getCaptionSkin(id: unknown): CaptionSkin {
  return CAPTION_SKINS.find((skin) => skin.id === id) ?? CAPTION_SKINS[0]
}
