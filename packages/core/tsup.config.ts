import { defineConfig } from 'tsup'

/**
 * Three entry points, because the two adapters must stay separable: the browser
 * bundle must never pull in @napi-rs/canvas, and a CLI must never pull in pica.
 *
 * `dts: true` is the point of this build. Exporting raw TS (`main: ./src/index.ts`)
 * made a CONSUMER's tsc compile this package's source under the CONSUMER's
 * config -- so pica's missing declarations and the Node adapter's `Buffer` became
 * their errors, in a browser app that imports neither. Emitting .d.ts keeps all
 * of that inside this package.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/browser': 'src/adapters/browser.ts',
    'adapters/node': 'src/adapters/node.ts',
  },
  format: ['esm'],
  target: 'node18',
  dts: true,
  clean: true,
  sourcemap: true,
  // Native and optional peers stay external -- they are real dependencies of
  // whichever host installs them, not things to inline.
  external: ['@napi-rs/canvas', '@resvg/resvg-js', 'pica'],
})
