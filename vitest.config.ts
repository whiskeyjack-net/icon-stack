import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// App-level tests run in jsdom; the packages have their own node-environment
// configs. This one deliberately does not include packages/**.
export default defineConfig({
  plugins: [react()],
  // The app has TWO Vite configs, and `define` does not carry between them:
  // vite.config.ts covers dev and build, this one covers tests. A define
  // declared only there makes every component that reads it throw here.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
