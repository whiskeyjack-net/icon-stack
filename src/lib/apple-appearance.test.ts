import { describe, expect, it } from 'vitest'
import { appleLayerFor, APPLE_APPEARANCES, TINTED_PLATE } from './apple-appearance'
import { DEFAULT_BACKDROP, backdropStyle, randomBackdrop } from './backdrop'

describe('appleLayerFor', () => {
  // The common case by far: light/dark/mono layers are only exported when that
  // variant is set to the alternate source, so most exports have one layer.
  it('falls back to the plain foreground when no dedicated layer was exported', () => {
    for (const appearance of APPLE_APPEARANCES) {
      expect(appleLayerFor(appearance, ['regular']).variant).toBe('regular')
    }
  })

  it('uses the dedicated layer when the export has one', () => {
    const available = ['regular', 'light', 'dark', 'mono'] as const
    expect(appleLayerFor('light', [...available]).variant).toBe('light')
    expect(appleLayerFor('dark', [...available]).variant).toBe('dark')
    expect(appleLayerFor('tinted', [...available]).variant).toBe('mono')
  })

  it('renders tinted as a silhouette whether or not a mono layer exists', () => {
    // macOS drops the icon's color in this appearance, so a colour foreground
    // has to be tinted rather than shown as-is.
    expect(appleLayerFor('tinted', ['regular']).monochrome).toBe(true)
    expect(appleLayerFor('tinted', ['regular', 'mono']).monochrome).toBe(true)
  })

  it('never tints the light or dark appearance', () => {
    expect(appleLayerFor('light', ['regular', 'mono']).monochrome).toBe(false)
    expect(appleLayerFor('dark', ['regular', 'dark']).monochrome).toBe(false)
  })

  it('picks dark artwork only for the dark appearance', () => {
    const available = ['regular', 'dark'] as const
    expect(appleLayerFor('light', [...available]).variant).toBe('regular')
    expect(appleLayerFor('dark', [...available]).variant).toBe('dark')
  })

  it('survives an export with no regular layer at all', () => {
    expect(appleLayerFor('light', ['light']).variant).toBe('light')
    expect(appleLayerFor('dark', ['light']).variant).toBe('light')
  })

  it('keeps the tinted plate neutral', () => {
    // Honouring the configured fill here would show the one thing the
    // appearance exists to remove.
    expect(TINTED_PLATE).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('backdrop', () => {
  it('renders a colour and a layer stack', () => {
    const style = backdropStyle(DEFAULT_BACKDROP)
    expect(style.backgroundColor).toMatch(/^#/)
    expect(style.backgroundImage.split('radial-gradient').length - 1).toBe(
      DEFAULT_BACKDROP.layers.length,
    )
  })

  it('produces a fresh backdrop of the same shape', () => {
    const a = randomBackdrop()
    expect(a.layers).toHaveLength(DEFAULT_BACKDROP.layers.length)
    expect(a.color).toMatch(/^hsl\(/)
    for (const layer of a.layers) expect(layer).toMatch(/^radial-gradient\(at \d+% \d+%,/)
  })

  it('stays in a plausible-wallpaper band rather than rolling anything', () => {
    // A randomiser that can produce near-black or near-white surfaces keeps
    // rolling backdrops that answer nothing about the icon.
    for (let i = 0; i < 50; i++) {
      const lightness = Number(randomBackdrop().color.match(/(\d+)%\)$/)![1])
      expect(lightness).toBeGreaterThanOrEqual(70)
      expect(lightness).toBeLessThanOrEqual(85)
    }
  })
})
