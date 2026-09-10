/**
 * The shape of the output, pinned where a platform's documentation pins it.
 *
 * Each of these guards a change that was made against a measured problem or a
 * verified spec: Apple's `iconutil` reading `icp6` as 48px, Microsoft's rule
 * that only the 256 frame of an ICO is compressed, the required Windows Store
 * target-size set, Xcode's transparent dark icon, and the tray silhouettes that
 * replaced an RGB inversion. `generate.test.ts` checks the pipeline is valid;
 * this checks it is the pipeline the platforms ask for.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { createCanvas, loadImage } from '@napi-rs/canvas'

import { setCanvasBackend } from './canvas-backend'
import { nodeCanvasBackend } from './adapters/node'
import { generateIcons } from './generate'
import { createDefaultPlatforms, selectPlatforms, updatePlatform } from './defaults'
import { decodeIco } from './ico-decoder'
import {
  ICNS_ENTRIES,
  TRAY_WINDOWS_ICO_SIZES,
  WINDOWS_ICO_SIZES,
  WINDOWS_STORE_TARGET_SIZES,
} from './platform-configs'
import type { Platform, SourceImage } from './types'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const dataUrl = (file: string, mime: string) =>
  `data:${mime};base64,${readFileSync(join(repoRoot, file)).toString('base64')}`

const png: SourceImage = { type: 'png', dataUrl: dataUrl('fixtures/mark.png', 'image/png'), width: 1024, height: 1024 }
const svgText = readFileSync(join(repoRoot, 'fixtures/mark.svg'), 'utf8')
const svg: SourceImage = { type: 'svg', dataUrl: dataUrl('fixtures/mark.svg', 'image/svg+xml'), width: 512, height: 512, svgText }

async function run(platform: Platform, source: SourceImage = png, patch?: Record<string, unknown>, alternate: SourceImage | null = null) {
  let platforms = selectPlatforms(createDefaultPlatforms(), [platform])
  if (patch) platforms = updatePlatform(platforms, platform, patch as never)
  const zip = await generateIcons({
    source, alternate, platforms,
    sourceFit: 'contain', alternateFit: 'contain', faviconFit: 'contain', trayFit: 'contain',
    onProgress: () => {},
  })
  return unzipSync(zip)
}

/** Straight-alpha RGBA of a PNG, via Skia. */
async function pixels(bytes: Uint8Array) {
  const img = await loadImage(Buffer.from(bytes))
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data }
}

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0

beforeAll(async () => {
  setCanvasBackend(await nodeCanvasBackend())
})

describe('macOS .icns', () => {
  it('carries no icp6, and every entry holds a PNG of the size its OSType means', async () => {
    const files = await run('macos')
    const icns = files['macos/AppIcon.icns']
    const seen: Record<string, number> = {}
    let offset = 8
    while (offset < icns.length) {
      const type = String.fromCharCode(...icns.slice(offset, offset + 4))
      const length = u32(icns, offset + 4)
      seen[type] = u32(icns, offset + 8 + 16) // PNG IHDR width inside the entry
      offset += length
    }
    // Apple's iconutil reads icp6 as 48x48; this encoder used to put a 64px image in it.
    expect(seen).not.toHaveProperty('icp6')
    for (const { osType, size } of ICNS_ENTRIES) expect(seen[osType], osType).toBe(size)
  })
})

describe('Windows .ico', () => {
  it('stores frames under 256 as DIBs and the 256 frame as PNG', async () => {
    const frames = decodeIco((await run('windows'))['windows/app.ico'])
    expect(frames.map((f) => f.size)).toEqual(WINDOWS_ICO_SIZES)
    for (const frame of frames) {
      expect(frame.kind, `${frame.size}px`).toBe(frame.size < 256 ? 'bmp' : 'png')
    }
  })

  it('keeps the DIB frames faithful to the PNG render', async () => {
    // The two encodings of one frame must describe the same pixels, otherwise
    // Explorer and a browser preview would disagree about the icon.
    const files = await run('trayIcon')
    const frames = decodeIco(files['tray/windows/tray.ico'])
    for (const size of TRAY_WINDOWS_ICO_SIZES) {
      const frame = frames.find((f) => f.size === size)!
      const fromPng = await pixels(files[`tray/windows/tray-${size}.png`])
      expect(frame.kind).toBe(size < 256 ? 'bmp' : 'png')
      if (frame.kind === 'bmp') {
        let maxDiff = 0
        for (let i = 0; i < frame.rgba.length; i++) {
          maxDiff = Math.max(maxDiff, Math.abs(frame.rgba[i] - fromPng.data[i]))
        }
        // Skia round-trips straight alpha through premultiplied storage, so a
        // unit or two of drift on semi-transparent edge pixels is expected.
        expect(maxDiff, `${size}px`).toBeLessThanOrEqual(3)
      }
    }
  })
})

describe('Windows Store target-size icons', () => {
  it('ships every required size in all three theme variants', async () => {
    const names = Object.keys(await run('windowsStore'))
    for (const size of WINDOWS_STORE_TARGET_SIZES) {
      for (const suffix of ['', '_altform-unplated', '_altform-lightunplated']) {
        expect(names).toContain(`windows-store/Assets/Square44x44Logo.targetsize-${size}${suffix}.png`)
      }
    }
  })
})

describe('tray icons', () => {
  it('emits light and dark Windows sets, as .ico and as one PNG per size', async () => {
    const names = Object.keys(await run('trayIcon'))
    expect(names).toContain('tray/windows/tray.ico')
    expect(names).toContain('tray/windows/tray-dark.ico')
    for (const size of TRAY_WINDOWS_ICO_SIZES) {
      expect(names).toContain(`tray/windows/tray-${size}.png`)
      expect(names).toContain(`tray/windows/tray-dark-${size}.png`)
    }
  })

  it('draws the dark variant as a white silhouette that keeps the artwork alpha', async () => {
    const files = await run('trayIcon')
    const light = await pixels(files['tray/linux/tray-48.png'])
    const dark = await pixels(files['tray/linux/tray-dark-48.png'])
    let coloured = 0
    for (let i = 0; i < dark.data.length; i += 4) {
      // Same coverage as the light icon, and white wherever there is any.
      expect(Math.abs(dark.data[i + 3] - light.data[i + 3])).toBeLessThanOrEqual(2)
      if (dark.data[i + 3] > 8) {
        expect(dark.data[i]).toBeGreaterThan(250)
        expect(dark.data[i + 1]).toBeGreaterThan(250)
        expect(dark.data[i + 2]).toBeGreaterThan(250)
        coloured++
      }
    }
    expect(coloured).toBeGreaterThan(0)
  })
})

describe('legacy iOS', () => {
  it('ships an appiconset whose manifest names light, dark and tinted images that exist', async () => {
    const files = await run('ios')
    const contents = JSON.parse(new TextDecoder().decode(files['ios/AppIcon.appiconset/Contents.json']))
    const appearance = (img: { appearances?: { value: string }[] }) => img.appearances?.[0].value ?? 'light'
    expect(contents.images.map(appearance).sort()).toEqual(['dark', 'light', 'tinted'])
    for (const img of contents.images) {
      expect(files, img.filename).toHaveProperty(`ios/AppIcon.appiconset/${img.filename}`)
      expect(img).toMatchObject({ idiom: 'universal', platform: 'ios', size: '1024x1024' })
    }
  })

  it('bakes the plate into the light icon only, and makes the tinted one grayscale', async () => {
    const files = await run('ios')
    const light = await pixels(files['ios/AppIcon.appiconset/AppIcon-1024x1024.png'])
    const dark = await pixels(files['ios/AppIcon.appiconset/AppIcon-1024x1024-Dark.png'])
    const tinted = await pixels(files['ios/AppIcon.appiconset/AppIcon-1024x1024-Tinted.png'])
    // Corner pixel: the fixture's artwork is inset, so the plate shows there.
    expect(light.data[3]).toBe(255)
    expect(dark.data[3]).toBe(0)
    expect(tinted.data[3]).toBe(0)
    // Grayscale wherever there is coverage, with the dark icon's alpha. Counted
    // in a plain loop: a million-pixel image is too many `expect` calls.
    let covered = 0
    let alphaDrift = 0
    let chroma = 0
    for (let i = 0; i < tinted.data.length; i += 4) {
      alphaDrift = Math.max(alphaDrift, Math.abs(tinted.data[i + 3] - dark.data[i + 3]))
      if (tinted.data[i + 3] > 200) {
        covered++
        chroma = Math.max(
          chroma,
          Math.abs(tinted.data[i] - tinted.data[i + 1]),
          Math.abs(tinted.data[i + 1] - tinted.data[i + 2]),
        )
      }
    }
    expect(covered).toBeGreaterThan(1000)
    expect(alphaDrift).toBeLessThanOrEqual(2)
    expect(chroma).toBeLessThanOrEqual(2)
  })
})

describe('Apple .icon appearances', () => {
  type Layer = Record<string, unknown>
  const layers = (files: Record<string, Uint8Array>): Layer[] => {
    const json = JSON.parse(new TextDecoder().decode(files['apple/AppIcon.icon/icon.json']))
    return json.groups.flatMap((g: { layers: Layer[] }) => g.layers)
  }
  const opacity = (layer: Layer, appearance?: string): number => {
    const specs = (layer['opacity-specializations'] as { appearance?: string; value: number }[]) ?? []
    return specs.find((s) => s.appearance === appearance)?.value ?? (appearance ? opacity(layer) : 1)
  }

  it('shows the mono layer in the tinted appearance only', async () => {
    // Regression: with a mono layer and no light variant, the mono layer kept
    // its default opacity and was drawn on top of the foreground in light mode.
    const files = await run('apple', png, { monoSourceChoice: 'alternate' }, png)
    const mono = layers(files).find((l) => l['image-name'] === 'mono.png')!
    const fg = layers(files).find((l) => l['image-name'] === 'foreground.png')!
    expect([opacity(mono), opacity(mono, 'dark'), opacity(mono, 'tinted')]).toEqual([0, 0, 1])
    expect([opacity(fg), opacity(fg, 'dark'), opacity(fg, 'tinted')]).toEqual([1, 1, 0])
    expect(mono['fill-specializations']).toEqual([{ appearance: 'tinted', value: 'automatic' }])
    expect(fg['fill-specializations']).toBeUndefined()
  })

  it('gives a lone foreground the automatic tint fill Icon Composer defaults to', async () => {
    const [fg] = layers(await run('apple'))
    expect(fg['fill-specializations']).toEqual([{ appearance: 'tinted', value: 'automatic' }])
    expect(fg['opacity-specializations']).toBeUndefined()
  })
})

describe('Android', () => {
  it('keeps the monochrome layer inside the same safe zone as the foreground', async () => {
    const files = await run('android')
    const fg = await pixels(files['android/ic_launcher_foreground.png'])
    const mono = await pixels(files['android/ic_launcher_monochrome.png'])
    // The 18dp margin of a 108dp canvas is 72px of 432: fully transparent on both layers.
    const margin = 72
    for (const layer of [fg, mono]) {
      for (let y = 0; y < margin; y += 8) {
        for (let x = 0; x < 432; x += 8) expect(layer.data[(y * 432 + x) * 4 + 3]).toBe(0)
      }
    }
    // And the layers actually contain artwork.
    expect(fg.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true)
    expect(mono.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true)
  })
})

describe('Linux', () => {
  it('passes an SVG source through as the scalable icon, and only then', async () => {
    const fromSvg = await run('linux', svg)
    expect(new TextDecoder().decode(fromSvg['linux/icon.svg'])).toBe(svgText)
    expect(Object.keys(await run('linux', png))).not.toContain('linux/icon.svg')
  })
})
