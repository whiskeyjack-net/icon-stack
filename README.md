# Icon Stack

Generate a complete app-icon set for every platform from one source image.
macOS `.icns`, Windows `.ico`, Windows Store MSIX tiles, Android adaptive layers,
iOS, Linux, PWA icons with maskable variants, favicons, and tray icons.

- **Web app** – <https://whiskeyjack.net/icon-stack/>
- **CLI** – `npx @whiskeyjack-net/icon-stack generate --source logo.png --out ./icons`

```
.                     the web app (React + Vite)
packages/core         the icon pipeline, with the rasterizer injected
packages/cli          the icon-stack CLI over that core
fixtures/             test artwork, generated from fixtures/mark.svg
```

## Why this lives outside the monorepo

Icon Stack is built on the **published** `@whiskeyjack-net/*` packages and
scaffolded from `create-whiskeyjack`, exactly as any third party would. Chip Away
stays inside the Whiskeyjack monorepo on workspace source. Together they are a
control and an experiment: anything that works in one and not the other is a
packaging or documentation gap, and it gets written down in
[`FINDINGS.md`](./FINDINGS.md).

One implementation runs in both hosts. The Canvas2D surface the compositing code
needs is small and standard, so the rasterizer is injected rather than
reimplemented: the browser supplies DOM canvas plus pica, Node supplies Skia via
`@napi-rs/canvas`. SVG goes through resvg in Node, because Skia ignores `<style>`
blocks and silently renders such icons as a solid black square.

## Development

```bash
npm install
npm run dev        # web app
npm run lint
npm run build
npm test           # both packages
```

Regenerate test artwork with `node fixtures/build.mjs` after editing
`fixtures/mark.svg`.

## License

MIT
