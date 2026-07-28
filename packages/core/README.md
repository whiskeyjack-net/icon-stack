# @whiskeyjack-net/icon-stack-core

The icon-generation pipeline behind [Icon Stack](https://whiskeyjack.net/icon-stack/):
platform size tables, `.ico` and `.icns` encoders, compositing, and the
generator — with the rasterizer injected, so the same code runs in a browser and
in Node.

Most people want the CLI instead:

```bash
npx @whiskeyjack-net/icon-stack generate --source logo.png --out ./icons
```

This package is for building your own interface on top.

## Install

```bash
npm install @whiskeyjack-net/icon-stack-core
```

Then whichever rasterizer your host needs:

| Host | Install | Backend |
|---|---|---|
| Browser | `pica` | `@whiskeyjack-net/icon-stack-core/browser` |
| Node | `@napi-rs/canvas` `@resvg/resvg-js` | `@whiskeyjack-net/icon-stack-core/node` |

## Usage

Install a backend once at startup, then generate:

```ts
import {
  setCanvasBackend,
  generateIcons,
  createDefaultPlatforms,
  selectPlatforms,
} from '@whiskeyjack-net/icon-stack-core'
import { nodeCanvasBackend } from '@whiskeyjack-net/icon-stack-core/node'

setCanvasBackend(await nodeCanvasBackend())

const zipBytes = await generateIcons({
  source: { type: 'png', dataUrl, width: 1024, height: 1024 },
  alternate: null,
  platforms: selectPlatforms(createDefaultPlatforms(), ['pwa', 'favicon']),
  sourceFit: 'contain',
  alternateFit: 'contain',
  faviconFit: 'contain',
  trayFit: 'contain',
  onProgress: (percent) => console.log(percent),
})
```

`generateIcons` returns a ZIP as `Uint8Array`. In a browser, wrap it for
download:

```ts
const url = URL.createObjectURL(new Blob([zipBytes], { type: 'application/zip' }))
```

> Under current TypeScript lib types `Uint8Array` is generic over its backing
> buffer, so `new Blob([bytes])` can error with *SharedArrayBuffer is not
> assignable to ArrayBuffer*. Cast at the call site if you hit it.

## Platforms

`apple` (`.icon`), `macos` (`.icns` + iconset), `ios`, `android` (adaptive
layers + mipmaps + Play Store), `windows` (`.ico`), `windowsStore` (MSIX tiles),
`linux`, `pwa` (+ maskable), `favicon`, `appleTouchIcon`, `trayIcon`.

`createDefaultPlatforms()` returns a sensible full set. `updatePlatform(configs,
platform, patch)` edits one — it is generic over the platform key, because
writing `configs[key] = {…}` with a union key demands the intersection of every
config shape.

## Why the rasterizer is injected

The Canvas2D surface the compositing code needs is small and entirely standard,
so one implementation serves both hosts rather than two that could never agree
byte for byte. The browser backs it with DOM canvas plus pica; Node backs it
with Skia via `@napi-rs/canvas`. Only the downscaling kernel genuinely differs,
which is why `resize` is part of the backend rather than something the core
implements.

**SVG goes through resvg in Node, not Skia.** Skia's SVG renderer ignores
`<style>` blocks, so an icon that styles its shapes with CSS classes rather than
inline `fill` attributes rasterizes as a solid black square — while still
producing a perfectly valid PNG.

## License

MIT
