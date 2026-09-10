/**
 * The SVG favicon carries the favicon settings, checked by rendering it.
 *
 * Structure is asserted where structure is the contract (the source's own
 * viewBox and styles survive, the dark-mode rule is present when asked for).
 * The plate, corner and zoom are asserted on PIXELS, through resvg, because a
 * composed SVG that looks right as text and renders wrong is the failure that
 * matters -- and resvg is what the Node pipeline rasterizes SVG with anyway.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { composeSvgFavicon, roundedRectPath, SVG_FAVICON_SIZE } from './svg-favicon'
import type { SvgFaviconOptions } from './svg-favicon'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const mark = readFileSync(join(repoRoot, 'fixtures/mark.svg'), 'utf8')

/** A viewBox-only, non-square export with a <style> block, the shape Illustrator writes. */
const ILLUSTRATOR = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="uuid-1" data-name="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 157.9 172">
  <defs><style>.a { fill: #fff; }</style></defs>
  <path class="a" d="M0 0h157.9v172H0z"/>
</svg>`

const base: SvgFaviconOptions = {
  markup: ILLUSTRATOR,
  fallback: { width: 138, height: 150 },
  fit: 'contain',
  zoom: 100,
  bgFill: { type: 'solid', color: '#1E90FF' },
  bgTransparent: true,
  cornerRadius: 0,
  cornerSmoothing: 0,
  darkMode: false,
}

function render(svg: string, size = 64) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render()
  const rgba = png.pixels
  return {
    at: (x: number, y: number) => [...rgba.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)],
  }
}

describe('composeSvgFavicon', () => {
  it('nests the source whole, keeping its viewBox, styles and namespace', () => {
    const out = composeSvgFavicon(base)!
    expect(out.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_FAVICON_SIZE} ${SVG_FAVICON_SIZE}"`)).toBe(true)
    expect(out).toContain('viewBox="0 0 157.9 172"')
    expect(out).toContain('.a { fill: #fff; }')
    expect(out).toContain('data-name="Layer_1"')
    // The XML prolog belongs to a document, not to a nested element.
    expect(out).not.toContain('<?xml')
    expect(out).not.toContain('@media')
  })

  it('squares a non-square source and letterboxes it, as the .ico does', () => {
    const { at } = render(composeSvgFavicon(base)!)
    // 157.9:172 inside a square, contain: white artwork fills the middle
    // columns, and the outermost columns are transparent letterbox.
    expect(at(32, 32)[3]).toBe(255)
    expect(at(0, 32)[3]).toBe(0)
    expect(at(63, 32)[3]).toBe(0)
  })

  it('bakes the plate and the corner, and leaves the corner transparent', () => {
    const { at } = render(composeSvgFavicon({ ...base, bgTransparent: false, cornerRadius: 25 })!)
    expect(at(0, 0)[3]).toBe(0) // clipped corner
    expect(at(1, 32).slice(0, 3)).toEqual([0x1e, 0x90, 0xff]) // plate at the edge
    expect(at(32, 32).slice(0, 3)).toEqual([255, 255, 255]) // artwork on top
  })

  it('does not round without a plate, matching the raster rule', () => {
    const { at } = render(composeSvgFavicon({ ...base, cornerRadius: 25 })!)
    // Nothing to clip: the corner is simply the transparent letterbox.
    expect(at(0, 0)[3]).toBe(0)
    expect(composeSvgFavicon({ ...base, cornerRadius: 25 })).not.toContain('clipPath')
  })

  it('applies zoom around the centre', () => {
    const { at } = render(composeSvgFavicon({ ...base, zoom: 50, bgTransparent: false })!)
    // Half-size artwork: the middle is white, a point at 20% is the plate.
    expect(at(32, 32).slice(0, 3)).toEqual([255, 255, 255])
    expect(at(12, 32).slice(0, 3)).toEqual([0x1e, 0x90, 0xff])
  })

  it('embeds the dark-mode rule only when asked', () => {
    expect(composeSvgFavicon({ ...base, darkMode: true })).toContain('prefers-color-scheme: dark')
  })

  it('composes a gradient plate', () => {
    const out = composeSvgFavicon({
      ...base,
      bgTransparent: false,
      bgFill: { type: 'gradient', gradient: { topColor: '#FFFFFF', bottomColor: '#000000' } },
    })!
    expect(out).toContain('<linearGradient id="wj-plate"')
    const { at } = render(out)
    expect(at(1, 1)[0]).toBeGreaterThan(200)
    expect(at(1, 62)[0]).toBeLessThan(60)
  })

  it('falls back to the decoded size when the root has no viewBox', () => {
    const out = composeSvgFavicon({ ...base, markup: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>' })!
    expect(out).toContain('viewBox="0 0 138 150"')
  })

  it('returns null for markup with no svg root', () => {
    expect(composeSvgFavicon({ ...base, markup: '<html></html>' })).toBeNull()
  })

  it('handles the real fixture', () => {
    const { at } = render(composeSvgFavicon({ ...base, markup: mark, bgTransparent: false })!)
    expect(at(1, 1).slice(0, 3)).toEqual([0x1e, 0x90, 0xff])
  })
})

describe('roundedRectPath', () => {
  it('is a plain rectangle at zero radius and closes in every mode', () => {
    expect(roundedRectPath(10, 10, 0, 0)).toBe('M0 0H10V10H0Z')
    expect(roundedRectPath(10, 10, 3, 0)).toMatch(/^M3 0H7Q10 0 10 3.*Z$/)
    expect(roundedRectPath(10, 10, 3, 100)).toMatch(/^M3 0L7 0L.*Z$/)
  })
})
