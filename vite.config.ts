import path from 'path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }
let sha = 'dev'
try {
  sha = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  // Tarball installs or detached environments — fall back to 'dev'.
}
const buildTime = new Date().toISOString()

export default defineConfig({
  base: '/verbalis/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(sha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'VERBALIS',
        short_name: 'VERBALIS',
        description: 'Local-first CAT tool for professional translators',
        theme_color: '#0d0f10',
        background_color: '#0d0f10',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/verbalis/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z]{2,3}\.wiktionary\.org\/api\/rest_v1\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'wiktionary-rest-v1',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/[a-z]{2,3}\.wiktionary\.org\/w\/api\.php.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'wiktionary-action-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['sbd'],
  },
})
