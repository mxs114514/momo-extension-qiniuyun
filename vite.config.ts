/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        popup: 'popup.html',
        sidePanel: 'side-panel.html',
        offscreen: 'offscreen.html',
        background: 'src/extension/background.ts',
        contentScript: 'src/extension/content-script.ts',
      },
      output: {
        entryFileNames: (chunk) =>
          ['background', 'contentScript'].includes(chunk.name)
            ? 'assets/[name].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
