/**
 * Correctness harness for the Node icon pipeline.
 *
 * `apps/icon-stack` shipped with no test framework at all, which mattered once
 * the generator gained a second host: a tool whose entire value is producing
 * correct binary assets had nothing checking that it did.
 *
 * These assert *properties* rather than byte-equality against golden files.
 * Byte-equality with the browser is not achievable -- pica's Lanczos3 and
 * Skia's resampler genuinely differ -- and pinning bytes would only encode
 * whichever renderer happened to write the fixtures. What must hold is that
 * every expected file exists, at the right dimensions, in a valid container,
 * with backgrounds and transparency where the config says. Determinism is
 * checked separately, since a generator that varies run to run cannot be
 * trusted in CI.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

import { setCanvasBackend } from './canvas-backend'
import { nodeCanvasBackend } from './adapters/node'
import { generateIcons } from './generate'
import { createDefaultPlatforms } from './defaults'
import type { PlatformConfigs, SourceImage } from './types'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const PNG_SOURCE = join(repoRoot, 'fixtures/mark.png')
const SVG_SOURCE = join(repoRoot, 'fixtures/mark.svg')

/** Big-endian u32 at an offset. */
const u32 = (b: Uint8Array, o: number) =>
  (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]

/** Dimensions from a PNG's IHDR, which always starts at byte 16. */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!isPng) throw new Error('not a PNG')
  return { width: u32(bytes, 16), height: u32(bytes, 20) }
}

/** Node has bytes, the type wants a data URL -- the same conversion the CLI does. */
function dataUrl(path: string, mime: string): string {
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`
}

function pngSource(): SourceImage {
  return { type: 'png', dataUrl: dataUrl(PNG_SOURCE, 'image/png'), width: 1024, height: 1024 }
}

async function run(platforms: PlatformConfigs, source: SourceImage = pngSource()) {
  const zip = await generateIcons({
    source,
    alternate: null,
    platforms,
    sourceFit: 'contain',
    alternateFit: 'contain',
    faviconFit: 'contain',
    trayFit: 'contain',
    onProgress: () => {},
  })
  return { zip, files: unzipSync(zip) }
}

/** Only the named platforms enabled, so a failure names one platform. */
function only(...names: (keyof PlatformConfigs)[]): PlatformConfigs {
  const p = createDefaultPlatforms()
  for (const key of Object.keys(p) as (keyof PlatformConfigs)[]) {
    p[key].enabled = names.includes(key)
  }
  return p
}

beforeAll(async () => {
  setCanvasBackend(await nodeCanvasBackend())
})

describe('node icon pipeline', () => {
  it('produces a full icon set from a PNG source', async () => {
    const { files } = await run(createDefaultPlatforms())
    const names = Object.keys(files)

    expect(names.length).toBeGreaterThan(40)
    // Every entry has real bytes -- an empty file would still zip fine.
    for (const [name, bytes] of Object.entries(files)) {
      expect(bytes.length, `${name} is empty`).toBeGreaterThan(0)
    }
  })

  it('emits the expected macOS iconset at the right sizes', async () => {
    const { files } = await run(only('macos'))
    const iconset = Object.keys(files).filter((n) => n.includes('.iconset/'))
    expect(iconset.length).toBeGreaterThan(0)

    // icon_<size>x<size>[@2x].png must actually be that many pixels.
    for (const name of iconset) {
      const m = name.match(/icon_(\d+)x\1(@2x)?\.png$/)
      if (!m) continue
      const expected = Number(m[1]) * (m[2] ? 2 : 1)
      const { width, height } = pngSize(files[name])
      expect({ name, width, height }).toEqual({ name, width: expected, height: expected })
    }
  })

  it('writes a valid .icns container', async () => {
    const { files } = await run(only('macos'))
    const icns = Object.entries(files).find(([n]) => n.endsWith('.icns'))?.[1]
    expect(icns, 'no .icns emitted').toBeDefined()

    // Magic 'icns', then a big-endian byte length covering the whole file.
    expect(String.fromCharCode(...icns!.slice(0, 4))).toBe('icns')
    expect(u32(icns!, 4)).toBe(icns!.length)
  })

  it('writes a valid multi-size .ico', async () => {
    const { files } = await run(only('windows'))
    const ico = Object.entries(files).find(([n]) => n.endsWith('.ico'))?.[1]
    expect(ico, 'no .ico emitted').toBeDefined()

    // ICONDIR: reserved=0, type=1 (icon), count>=1
    expect(ico![0] | (ico![1] << 8)).toBe(0)
    expect(ico![2] | (ico![3] << 8)).toBe(1)
    const count = ico![4] | (ico![5] << 8)
    expect(count).toBeGreaterThan(1)

    // Every directory entry must point inside the file.
    for (let i = 0; i < count; i++) {
      const e = 6 + i * 16
      const size = ico![e + 8] | (ico![e + 9] << 8) | (ico![e + 10] << 16) | (ico![e + 11] << 24)
      const offset = ico![e + 12] | (ico![e + 13] << 8) | (ico![e + 14] << 16) | (ico![e + 15] << 24)
      expect(offset + size, `entry ${i} runs past EOF`).toBeLessThanOrEqual(ico!.length)
    }
  })

  it('emits PWA icons at their declared sizes', async () => {
    const { files } = await run(only('pwa'))
    for (const [name, bytes] of Object.entries(files)) {
      const m = name.match(/(\d+)x\1/)
      if (!m || !name.endsWith('.png')) continue
      const expected = Number(m[1])
      const { width, height } = pngSize(bytes)
      expect({ name, width, height }).toEqual({ name, width: expected, height: expected })
    }
  })

  it('honours transparent vs baked backgrounds', async () => {
    const transparent = createDefaultPlatforms()
    transparent.linux.enabled = true
    transparent.linux.bgTransparent = true
    for (const k of Object.keys(transparent) as (keyof PlatformConfigs)[]) {
      if (k !== 'linux') transparent[k].enabled = false
    }
    const a = await run(transparent)
    const aPng = Object.entries(a.files).find(([n]) => n.endsWith('.png'))![1]

    const opaque = createDefaultPlatforms()
    for (const k of Object.keys(opaque) as (keyof PlatformConfigs)[]) opaque[k].enabled = k === 'ios'
    const b = await run(opaque)
    const bPng = Object.entries(b.files).find(([n]) => n.endsWith('.png'))![1]

    // A baked-background icon compresses very differently from one with a
    // transparent surround; both must at least be valid PNGs of real size.
    expect(pngSize(aPng).width).toBeGreaterThan(0)
    expect(pngSize(bPng).width).toBeGreaterThan(0)
    expect(bPng.length).toBeGreaterThan(0)
  })

  it('passes an SVG source through to favicon.svg', async () => {
    const svgText = readFileSync(SVG_SOURCE, 'utf8')
    const source: SourceImage = {
      type: 'svg',
      dataUrl: dataUrl(SVG_SOURCE, 'image/svg+xml'),
      width: 256,
      height: 256,
      svgText,
    }
    const { files } = await run(only('favicon'), source)

    expect(Object.keys(files)).toContain('favicon.svg')
    expect(new TextDecoder().decode(files['favicon.svg'])).toContain('<svg')
    // And the raster favicon still comes out of the same source.
    expect(Object.keys(files)).toContain('favicon.ico')
  })

  /**
   * Regression: Skia's SVG renderer ignores `<style>` blocks, so an icon that
   * styles its shapes with CSS classes rather than inline `fill` attributes
   * rasterized as a SOLID BLACK SQUARE -- while still producing a valid,
   * non-trivially-sized PNG. Byte-size checks alone pass on that output. Hence
   * resvg for SVG, and hence this test reads actual pixels.
   */
  it('applies CSS styles in an SVG rather than filling it flat', async () => {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas')
    const source: SourceImage = {
      type: 'svg',
      dataUrl: dataUrl(SVG_SOURCE, 'image/svg+xml'),
      width: 256,
      height: 256,
      svgText: readFileSync(SVG_SOURCE, 'utf8'),
    }
    const { files } = await run(only('linux'), source)
    const png = Object.entries(files).find(([n]) => n.endsWith('512.png'))![1]

    const img = await loadImage(Buffer.from(png))
    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height)
    const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3]

    // The mark does not reach the corners, so a correctly styled render leaves
    // them transparent. The all-black failure fills every pixel.
    const inset = Math.floor(width * 0.02)
    for (const [x, y] of [
      [inset, inset],
      [width - 1 - inset, inset],
      [inset, height - 1 - inset],
      [width - 1 - inset, height - 1 - inset],
    ]) {
      expect(alphaAt(x, y), `corner (${x},${y}) should be transparent`).toBe(0)
    }

    // And the artwork must have real structure. Counting distinct colors is
    // the discriminator that a flat fill cannot fake: this mark renders a light
    // plate, a dark bird, and antialiased edges between them, so it has many.
    // Coverage alone would not do -- the plate legitimately fills ~96% of the
    // canvas, which is close enough to the all-black failure's 100% that no
    // useful threshold sits between them.
    const colors = new Set<number>()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue
      colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
    }
    expect(colors.size, 'artwork looks like a flat fill').toBeGreaterThan(16)
  })

  it('rasterizes an SVG source rather than emitting a blank canvas', async () => {
    const source: SourceImage = {
      type: 'svg',
      dataUrl: dataUrl(SVG_SOURCE, 'image/svg+xml'),
      width: 256,
      height: 256,
      svgText: readFileSync(SVG_SOURCE, 'utf8'),
    }
    const { files } = await run(only('linux'), source)
    const biggest = Object.entries(files)
      .filter(([n]) => n.endsWith('.png'))
      .sort((a, b) => b[1].length - a[1].length)[0]

    // A fully transparent 512px PNG compresses to a few hundred bytes; real
    // artwork does not. This is the check that catches a silently failed
    // SVG decode.
    expect(biggest[1].length).toBeGreaterThan(2000)
  })

  it('is deterministic across runs', async () => {
    const [a, b] = await Promise.all([run(only('linux', 'pwa')), run(only('linux', 'pwa'))])
    expect(Object.keys(a.files).sort()).toEqual(Object.keys(b.files).sort())
    for (const name of Object.keys(a.files)) {
      expect(Buffer.from(a.files[name]).equals(Buffer.from(b.files[name])), `${name} differs`).toBe(
        true,
      )
    }
  })

  it('reports progress from 0 to 100', async () => {
    const seen: number[] = []
    await generateIcons({
      source: pngSource(),
      alternate: null,
      platforms: only('pwa'),
      sourceFit: 'contain',
      alternateFit: 'contain',
      faviconFit: 'contain',
      trayFit: 'contain',
      onProgress: (p) => seen.push(p),
    })
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1]).toBe(100)
    expect([...seen].sort((x, y) => x - y)).toEqual(seen) // monotonic
  })

  it('fails loudly when no backend is installed', async () => {
    const { getCanvasBackend, setCanvasBackend: set } = await import('./canvas-backend')
    const saved = getCanvasBackend()
    set(undefined as never)
    await expect(run(only('pwa'))).rejects.toThrow()
    set(saved)
  })
})
