import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Served from a subpath of whiskeyjack.net, so assets must be
  // prefixed. Without this every /assets/* request 404s.
  base: '/icon-stack/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
