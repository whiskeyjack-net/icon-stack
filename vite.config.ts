import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { appDefines } from './app-defines.mjs'

export default defineConfig({
  // Served from a subpath of whiskeyjack.net, so assets must be
  // prefixed. Without this every /assets/* request 404s.
  base: '/icon-stack/',
  // Shared with vitest.config.ts, which needs the identical set (see the file).
  define: appDefines,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // NOT the default `sw.js`. That path is occupied by a tombstone worker
      // (public/sw.js) whose whole job is to unregister the PREVIOUS PWA and
      // drop its precache -- a stale precache there is what made the rebuilt app
      // render blank until you navigated away and back. Publishing a real worker
      // at the same URL would hand any device still holding the old registration
      // a straight old-SW -> new-SW upgrade, skipping that cleanup entirely.
      //
      // With a distinct filename the two never collide: an old device still
      // fetches the tombstone, unregisters, and only then does the page register
      // this one. The tombstone can be deleted once no device plausibly holds the
      // retired worker, and that deletion will not touch this.
      filename: 'service-worker.js',
      workbox: {
        // Drop precaches from earlier revisions on activate, so an update never
        // leaves a device serving a mix of two builds.
        cleanupOutdatedCaches: true,
        // The default globPatterns omit fonts; woff2 is listed so a self-hosted
        // brand font would survive offline if one is ever added.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        // The tombstone is a `.js` file in public/, so it lands in the precache
        // by default -- caching the worker whose entire purpose is to stop a
        // cache from being served. Pointless bytes, and backwards.
        globIgnores: ['sw.js'],
        // Every route is client-rendered from one entry and GitHub Pages has no
        // server to ask, so an offline deep link resolves to the app shell and
        // the router takes it from there.
        navigateFallback: '/icon-stack/index.html',
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'og-image.jpg'],
      manifest: {
        name: 'Icon Stack',
        short_name: 'Icon Stack',
        description: 'One source image in, a complete app-icon set out.',
        theme_color: '#f2f0ed',
        background_color: '#f2f0ed',
        display: 'standalone',
        start_url: '/icon-stack/',
        scope: '/icon-stack/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
