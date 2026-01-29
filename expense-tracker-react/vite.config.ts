import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env vars from .env files (CI creates .env.production with VITE_BASE=/repoName/)
  // Third param '' loads all vars, not just VITE_ prefixed
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE || '/'
  console.log(`[vite.config] mode=${mode}, VITE_BASE=${env.VITE_BASE}, base=${base}`)

  return {
    base,
    plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Expense Tracker',
        short_name: 'Expenses',
        description: 'Track expenses, split bills, sync with friends',
        theme_color: '#075e54',
        background_color: '#f0f2f5',
        display: 'standalone',
        orientation: 'portrait',
        // Use '.' for start_url so it's relative to manifest location
        start_url: '.',
        icons: [
          {
            // Relative paths - resolved from manifest location
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    host: true
  }
  }
})
