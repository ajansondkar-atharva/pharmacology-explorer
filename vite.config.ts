import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Pharmacology Explorer',
        short_name: 'Pharm.Explorer',
        description: 'Offline-first pharmacology encyclopedia — monographs, interactions, PK, guidelines, study tools.',
        theme_color: '#0A0E13',
        background_color: '#0A0E13',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 4096
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
