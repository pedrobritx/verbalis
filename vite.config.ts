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
const base = process.env.VITE_BASE_PATH ?? '/'
const normalizedBase = base.endsWith('/') ? base : `${base}/`

export default defineConfig({
  base: normalizedBase,
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
        name: 'Verbalis — local-first CAT tool',
        short_name: 'Verbalis',
        description:
          'Local-first, privacy-first CAT tool for professional translators. Your files, translation memory and glossaries never leave your browser.',
        categories: ['productivity', 'utilities'],
        lang: 'en',
        theme_color: '#0d0f10',
        background_color: '#0d0f10',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: `${normalizedBase}index.html`,
        runtimeCaching: [
          {
            // Bundled terminology corpora and the translation guide — fetched on
            // demand, cached so they remain available offline after first use.
            urlPattern: /\/(corpora|guide)\/.*\.(json|md)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'verbalis-corpora',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Bundled Hunspell dictionaries — large static assets fetched on
            // demand (never precached); cached so spell-check works offline.
            urlPattern: /\/dictionaries\/.*\.(aff|dic)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'verbalis-dictionaries',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
          {
            // Cache the @xenova/transformers model files so semantic TM works
            // offline after a one-time download.
            urlPattern: /^https:\/\/huggingface\.co\/.*\/resolve\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'xenova-models',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    // ES-module workers so @xenova/transformers (used by the embeddings worker)
    // can be code-split and dynamically imported.
    format: 'es',
  },
  optimizeDeps: {
    include: ['sbd'],
    exclude: ['@xenova/transformers'],
  },
})
