# icon-stack

Generate a complete app-icon set for every platform from one source image.

```bash
npx @whiskeyjack-net/icon-stack generate --source logo.png --out ./assets/icons
```

One 1024×1024 PNG (or an SVG) in; macOS `.icns` and `.iconset`, Windows `.ico`,
Windows Store MSIX tiles, Android adaptive layers and mipmaps, iOS, Linux, PWA
icons with maskable variants, favicons, an Apple touch icon, and tray icons out.

## Usage

```
icon-stack generate --source <file> [--out <dir>] [options]
icon-stack platforms
icon-stack inspect --source <file>
```

| Option | Description |
|---|---|
| `-s, --source <file>` | Source PNG or SVG. 1024×1024 square recommended. |
| `-o, --out <dir>` | Output directory (default: `icons`) |
| `-p, --platforms <list>` | Comma-separated subset, e.g. `favicon,pwa` |
| `--fit <contain\|cover>` | How a non-square source fills the square (default: `contain`) |
| `--zoom <n>` | Logo scale percent, 100 = fill |
| `--corner-radius <n>` | Corner rounding percent, 0–50 |
| `-b, --background <hex>` | Bake a solid background, e.g. `#1E90FF` |
| `--transparent` | Force transparent backgrounds |
| `--json` | Machine-readable output |
| `-q, --quiet` | Only report errors |

`icon-stack platforms` lists the platform ids. `icon-stack inspect` reports a
source's dimensions and any quality warnings without generating anything.

## Examples

```bash
# Everything, into a project's assets directory
icon-stack generate -s logo.png -o ./assets/icons

# Just the web set, on a brand-coloured plate
icon-stack generate -s logo.svg -p favicon,pwa -b '#1E90FF'

# Check a source before committing to it
icon-stack inspect -s logo.png --json
```

Scaffolding a new app and giving it icons is two commands:

```bash
npm create whiskeyjack@latest my-app
npx @whiskeyjack-net/icon-stack generate -s logo.png -o my-app/public
```

## For scripts and agents

`--json` prints the source metadata, the resolved platform list, any warnings,
and every file written, so a caller never has to parse human-readable output or
guess at the tree:

```json
{
  "source": { "path": "/…/logo.png", "width": 1024, "height": 1024, "type": "png" },
  "outDir": "/…/assets/icons",
  "platforms": ["pwa", "favicon"],
  "warnings": [],
  "files": ["favicon.ico", "pwa/icon-192.png", "pwa/icon-512.png", "…"]
}
```

Exit codes are 0 on success and 1 on any error, with the reason on stderr.

## Notes

- **SVG sources are rasterized with resvg**, which honours `<style>` blocks.
  Icons that style their shapes with CSS classes rather than inline `fill`
  attributes render correctly.
- Raster compositing runs on Skia via `@napi-rs/canvas`, the same engine the
  browser uses for canvas, so this shares one implementation with the
  [Icon Stack web app](https://whiskeyjack.net/icon-stack/) rather than
  reimplementing it.
- Output is deterministic: the same source and options produce the same bytes.

## License

MIT
