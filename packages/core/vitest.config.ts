import { defineConfig } from 'vitest/config'

// Pure-node environment: this package's whole point is running the icon
// pipeline outside a browser. The rasterizer is @napi-rs/canvas, not jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
  },
})
