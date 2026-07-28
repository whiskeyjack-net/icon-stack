import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  // Native and workspace deps stay external; they are real dependencies of the
  // published package rather than things to inline.
  external: ['@napi-rs/canvas'],
  noExternal: ['@whiskeyjack-net/icon-stack-core'],
})
