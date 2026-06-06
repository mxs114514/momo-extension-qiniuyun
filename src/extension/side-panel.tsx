/**
 * 浏览器扩展侧边栏 (Side Panel) 的独立入口页面程序。
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { SessionHistoryPanelView } from '../features/session-history/SessionHistoryPanel'
import { useExtensionSessionHistory } from './use-extension-session-history'

export function SidePanel() {
  const model = useExtensionSessionHistory()
  return <SessionHistoryPanelView model={model} />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
)
