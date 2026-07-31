import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { appDefines } from './app-defines.mjs'

// App-level tests run in jsdom; the packages have their own node-environment
// configs. This one deliberately does not include packages/**.
export default defineConfig({
  plugins: [react()],
  // The app has TWO Vite configs and `define` does not carry between them, so
  // both import the same block. Declaring one here and not there (or the
  // reverse) makes every component that reads it throw at module scope.
  define: appDefines,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
