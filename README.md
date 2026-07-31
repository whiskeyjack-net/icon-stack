# Icon Stack

One source image in, a complete app-icon set out.

Drop in a 1024×1024 PNG or an SVG and get every icon a project needs: macOS
`.icns` and `.iconset`, Windows `.ico`, Windows Store MSIX tiles, Android
adaptive layers and mipmaps, iOS, Linux, PWA icons with maskable variants,
favicons, an Apple touch icon, and tray icons.

- **Web app** – <https://whiskeyjack.net/icon-stack/>
- **CLI** – `npx @whiskeyjack-net/icon-stack generate --source logo.png --out ./icons`

Both run the same pipeline, so the CLI and the Export button produce
byte-identical output. Reach for the CLI when the source changes more often
than you want to click, or when a build script should own it.

## What it does

**Every platform, or a subset.** Pick the platforms you need. Each one carries
its own size table, container format and naming convention, so the output drops
straight into an Xcode project, an Android `res/` tree, or a `public/` folder
without renaming anything.

**A live preview in the shape the OS gives it.** Icons are previewed at the
sizes each platform actually ships, masked the way the platform masks them: the
iOS squircle, Android's adaptive circle and safe area, the macOS plate. What you
see is what lands in the ZIP.

**A second source image, when one mark will not do.** A logo that reads on a
light plate often disappears knocked out on a dark one. Load an alternate and
platforms pick between the two per variant, so dark, monochrome and taskbar
icons can use different artwork.

**Per-platform adjustment.** Fit (contain or cover) for non-square sources,
logo zoom, corner rounding, and a baked background colour or forced
transparency. Set them globally, then override per platform where one target
needs something different.

**Nothing is uploaded.** The whole pipeline runs in your browser. The web app is
installable and works offline, and no image ever leaves your device.

## Using the CLI

```bash
# Everything, into a project's assets directory
npx @whiskeyjack-net/icon-stack generate -s logo.png -o ./assets/icons

# Just the web set, on a brand-colored plate
npx @whiskeyjack-net/icon-stack generate -s logo.svg -p favicon,pwa -b '#1E90FF'

# Check a source before committing to it
npx @whiskeyjack-net/icon-stack inspect -s logo.png
```

`--json` prints the source metadata, resolved platforms, warnings and every file
written, so scripts and agents never have to parse human-readable output. Full
option table in [`packages/cli/README.md`](./packages/cli/README.md).

## Packages

| Package | What it is |
|---|---|
| [`@whiskeyjack-net/icon-stack`](./packages/cli) | The CLI |
| [`@whiskeyjack-net/icon-stack-core`](./packages/core) | The pipeline itself, for building your own interface on top |

The core injects its rasterizer rather than reimplementing one per host: the
browser supplies DOM canvas plus pica, Node supplies Skia via `@napi-rs/canvas`.
SVG goes through resvg in Node, because Skia ignores `<style>` blocks and
silently renders such icons as a solid black square.

## Development

```bash
npm install
npm run dev        # web app
npm run lint
npm run build
npm test           # the app, then both packages
```

```
.                  the web app (React + Vite)
packages/core      the icon pipeline, with the rasterizer injected
packages/cli       the CLI over that core
fixtures/          test artwork, generated from fixtures/mark.svg
```

Regenerate test artwork with `node fixtures/build.mjs` after editing
`fixtures/mark.svg`. Conventions for contributors and coding agents are in
[`AGENTS.md`](./AGENTS.md); the release runbook for the two published packages
is in [`RELEASING.md`](./RELEASING.md).

Icon Stack is built on the published `@whiskeyjack-net/*` packages and scaffolded
from `create-whiskeyjack`, exactly as any third party would consume them. Gaps
that surface from being an outside consumer are recorded in
[`FINDINGS.md`](./FINDINGS.md) and fed back to the design system.

## License

MIT
