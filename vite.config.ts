/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Teoriträning',
        short_name: 'Teori',
        display: 'standalone',
        start_url: '/',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts?(x)'],
    setupFiles: ['tests/setup.ts'],
  },
})
