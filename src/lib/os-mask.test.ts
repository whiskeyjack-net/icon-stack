import { describe, expect, it } from 'vitest'
import { osMaskFor } from './os-mask'
import { sizesOf, type RenderedIcon } from './icon-variants'

const icon = (size: number, name = `icon-${size}.png`): RenderedIcon => ({
  name,
  size,
  bytes: new Uint8Array(),
})

describe('osMaskFor', () => {
  it('rounds the platforms that round it themselves', () => {
    expect(osMaskFor('macos', 'regular').radius).toBe('22.37%')
    expect(osMaskFor('ios', 'regular').radius).toBe('22.37%')
    expect(osMaskFor('apple', 'regular').radius).toBe('22.37%')
    expect(osMaskFor('appleTouchIcon', 'regular').radius).toBe('22.37%')
    expect(osMaskFor('android', 'regular').radius).toBe('50%')
  })

  it('leaves square the platforms that ship a square file', () => {
    // Windows, Linux and favicon bake their corner radius into the PNG, so the
    // pixels already carry it. Masking here would round it a second time.
    for (const platform of ['windows', 'windowsStore', 'linux', 'favicon', 'trayIcon'] as const) {
      expect(osMaskFor(platform, 'regular').radius).toBeNull()
    }
  })

  it('crops a PWA icon only when it is the maskable one', () => {
    // The maskable variant is drawn to be cropped; the plain one is used as-is
    // in tabs and task switchers, where cropping it would invent a constraint.
    expect(osMaskFor('pwa', 'maskable').radius).toBe('50%')
    expect(osMaskFor('pwa', 'regular').radius).toBeNull()
  })

  it('leaves an Android adaptive layer uncropped', () => {
    // A launcher composites the layers and masks the result. Masking a layer on
    // its own shows a circular foreground floating on nothing, which no device
    // ever renders.
    expect(osMaskFor('android', 'foreground').radius).toBeNull()
    expect(osMaskFor('android', 'background').radius).toBeNull()
    expect(osMaskFor('android', 'mono').radius).toBeNull()
  })

  it('keeps masking the variants that are still whole icons', () => {
    expect(osMaskFor('android', 'maskable').radius).toBe('50%')
    expect(osMaskFor('macos', 'dark').radius).toBe('22.37%')
  })
})

describe('sizesOf', () => {
  it('returns each size once, ascending', () => {
    expect(sizesOf([icon(128), icon(16), icon(64), icon(16)])).toEqual([16, 64, 128])
  })

  it('is empty for an empty variant', () => {
    expect(sizesOf([])).toEqual([])
  })

  it('counts a size once even when two different files carry it', () => {
    // macOS ships icon_16x16.png and icon_16x16@2x.png; the retina one is 32.
    expect(sizesOf([icon(16, 'icon_16x16.png'), icon(16, 'icon_16x16_alt.png')])).toEqual([16])
  })
})
