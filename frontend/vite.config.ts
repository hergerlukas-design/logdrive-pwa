import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  // In Einstellungen angezeigt, damit sichtbar ist, welcher Stand läuft
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__:  JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // Neue Versionen warten, bis der Nutzer im Update-Banner bestätigt (siehe UpdatePrompt)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'LogDrive',
        short_name: 'LogDrive',
        description: 'Digitales Fahrtenbuch & Ausgaben-Scanner',
        theme_color: '#bc0120',
        background_color: '#f3f4f6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
})
