import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LogDrive',
        short_name: 'LogDrive',
        description: 'Digitale Fahrtenbuch PWA',
        theme_color: '#bc0120',
        background_color: '#f3f4f6',
        display: 'standalone',
        icons: [
          {
            src: '/vite.svg', // Vorerst nutzen wir das Standard-Icon von Vite
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})