/**
 * Node backend, on `@napi-rs/canvas` (Skia -- the engine Chrome uses for
 * canvas). Because it implements the same Canvas2D surface the compositing code
 * needs, every drawing rule in this package runs unchanged on both hosts. Only
 * the downscaling kernel genuinely differs from the browser's pica.
 *
 * `@napi-rs/canvas` is an optional peer: the browser bundle never imports this
 * file, so the web app pays nothing for it.
 */
import type { CanvasBackend, IconCanvas, IconDrawable } from '../canvas-backend'

type NapiCanvasModule = typeof import('@napi-rs/canvas')

/**
 * Skia's one-shot `drawImage` downscale softens detail badly at the ratios icon
 * work demands (1024 -> 16 is 64x). Halving repeatedly with smoothing on is the
 * standard fix and lands very close to a Lanczos result, which keeps the two
 * backends' output comparable.
 */
function steppedDownscale(
  mod: NapiCanvasModule,
  source: IconCanvas,
  targetWidth: number,
  targetHeight: number,
): IconCanvas {
  let current = source
  let w = source.width
  let h = source.height

  while (w / 2 >= targetWidth && h / 2 >= targetHeight && w > 1 && h > 1) {
    const nextW = Math.max(Math.floor(w / 2), targetWidth)
    const nextH = Math.max(Math.floor(h / 2), targetHeight)
    const step = mod.createCanvas(nextW, nextH)
    const ctx = step.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(current as never, 0, 0, nextW, nextH)
    current = step as unknown as IconCanvas
    w = nextW
    h = nextH
  }

  if (w === targetWidth && h === targetHeight) return current

  const out = mod.createCanvas(targetWidth, targetHeight)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(current as never, 0, 0, targetWidth, targetHeight)
  return out as unknown as IconCanvas
}

/**
 * Build the Node backend. Async because `@napi-rs/canvas` is loaded on demand,
 * keeping it out of any bundle that does not ask for it.
 */
export async function nodeCanvasBackend(): Promise<CanvasBackend> {
  let mod: NapiCanvasModule
  try {
    mod = await import('@napi-rs/canvas')
  } catch {
    throw new Error(
      'The Node canvas backend needs @napi-rs/canvas. Install it alongside ' +
        '@whiskeyjack-net/icon-stack-core.',
    )
  }

  return {
    createCanvas(width, height) {
      return mod.createCanvas(width, height) as unknown as IconCanvas
    },

    async loadImage(src, size) {
      const svg = asSvgMarkup(src)
      if (svg !== null) {
        // SVG goes through resvg, NOT Skia. Skia's SVG support ignores `<style>`
        // blocks, so any icon that styles its shapes with CSS classes rather
        // than inline `fill` attributes rasterizes as solid black -- silently,
        // and the output is still a valid PNG. Caught by rendering a real
        // logo rather than a hand-written test SVG with inline fills.
        const png = await rasterizeSvg(svg, size?.width ?? 1024)
        return (await mod.loadImage(Buffer.from(png))) as unknown as IconDrawable
      }
      const input = typeof src === 'string' ? src : Buffer.from(src)
      return (await mod.loadImage(input as never)) as unknown as IconDrawable
    },

    async resize(source, targetWidth, targetHeight) {
      return steppedDownscale(mod, source, targetWidth, targetHeight)
    },

    async toPng(canvas) {
      const buf = (canvas as unknown as { toBuffer(mime: 'image/png'): Buffer }).toBuffer('image/png')
      return new Uint8Array(buf)
    },
  }
}

/** Returns SVG markup when `src` is an SVG (bytes, data URL, or raw markup). */
function asSvgMarkup(src: string | Uint8Array): string | null {
  if (typeof src === 'string') {
    if (src.startsWith('data:image/svg+xml')) return decodeSvgDataUrl(src)
    if (src.trimStart().startsWith('<svg') || src.trimStart().startsWith('<?xml')) {
      return src.includes('<svg') ? src : null
    }
    return null
  }
  const head = Buffer.from(src.slice(0, 256)).toString('utf8').trimStart()
  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    return Buffer.from(src).toString('utf8')
  }
  return null
}

function decodeSvgDataUrl(url: string): string {
  const comma = url.indexOf(',')
  const meta = url.slice(0, comma)
  const payload = url.slice(comma + 1)
  return meta.includes('base64')
    ? Buffer.from(payload, 'base64').toString('utf8')
    : decodeURIComponent(payload)
}

/**
 * Rasterize SVG with resvg at the requested width. Kept separate from Skia
 * deliberately -- see the note in loadImage.
 */
async function rasterizeSvg(markup: string, width: number): Promise<Uint8Array> {
  let Resvg: typeof import('@resvg/resvg-js').Resvg
  try {
    ;({ Resvg } = await import('@resvg/resvg-js'))
  } catch {
    throw new Error(
      'SVG sources need @resvg/resvg-js. Install it alongside @whiskeyjack-net/icon-stack-core, ' +
        'or convert the source to PNG first.',
    )
  }
  const renderer = new Resvg(markup, { fitTo: { mode: 'width', value: Math.max(1, Math.round(width)) } })
  return renderer.render().asPng()
}
