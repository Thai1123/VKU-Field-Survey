import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest lets us own the Service Worker source (sw.ts) so we can
      // implement Cache-First app-shell caching AND the Background Sync queue
      // by hand, instead of relying on the auto-generated Workbox SW.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Keep the precache manifest small & predictable for the App Shell.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'VKU Field Survey',
        short_name: 'VKU Survey',
        description:
          'Offline-first facility inspection tool for VKU campus auditors.',
        theme_color: '#0284c7',
        background_color: '#f4f6f8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Forwards to `npm run mock-server` (server/index.js) during local dev.
      '/api': 'http://localhost:4000',
    },
  },
});
