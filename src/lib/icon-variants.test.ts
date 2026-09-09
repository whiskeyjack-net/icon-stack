/**
 * Icon variant grouping.
 *
 * These paths are copied from real CLI output for each platform, not invented,
 * because the classifier's whole job is to read paths the core chooses.
 *
 * The bug that prompted it: the preview picked "the closest render at or above
 * this size" across a platform's entire file set. For PWA that made
 * `icon-192.png` and `icon-maskable-192.png` interchangeable candidates and
 * whichever came first out of the file map won, so the preview could show the
 * maskable icon while claiming to be the icon. For Android it could show
 * `ic_launcher_background.png` -- a solid plate with no artwork on it.
 */
import { describe, it, expect } from 'vitest'
import { variantOf, groupByVariant, sizesOf, VARIANT_ORDER } from './icon-variants'

/** A minimal valid PNG header carrying a square size in its IHDR. */
function fakePng(size: number): Uint8Array {
  const b = new Uint8Array(24)
  b[0] = 0x89
  b[1] = 0x50
  for (const [offset, value] of [
    [16, size],
    [20, size],
  ] as const) {
    b[offset] = (value >> 24) & 0xff
    b[offset + 1] = (value >> 16) & 0xff
    b[offset + 2] = (value >> 8) & 0xff
    b[offset + 3] = value & 0xff
  }
  return b
}

describe('variantOf', () => {
  it.each([
    ['pwa/icon-192.png', 'regular'],
    ['pwa/icon-maskable-512.png', 'maskable'],
    ['tray/linux/tray-32.png', 'regular'],
    ['tray/linux/tray-dark-32.png', 'dark'],
    ['tray/macos/trayTemplate@2x.png', 'regular'],
    ['tray/macos/trayTemplate-dark@2x.png', 'dark'],
    ['android/ic_launcher_foreground.png', 'foreground'],
    ['android/ic_launcher_monochrome.png', 'mono'],
    ['android/mipmap-hdpi/ic_launcher.png', 'regular'],
    ['ios/AppIcon.appiconset/AppIcon-1024x1024.png', 'regular'],
    ['ios/AppIcon.appiconset/AppIcon-1024x1024-Dark.png', 'dark'],
    ['ios/AppIcon.appiconset/AppIcon-1024x1024-Tinted.png', 'mono'],
    ['apple/AppIcon.icon/Assets/foreground.png', 'foreground'],
    ['apple/AppIcon.icon/Assets/mono.png', 'mono'],
    ['windows-store/Assets/Square44x44Logo.scale-200.png', 'regular'],
    // The three target-size files are the taskbar's dark and light icons, and the
    // one Windows plates itself.
    ['windows-store/Assets/Square44x44Logo.targetsize-48_altform-unplated.png', 'dark'],
    ['windows-store/Assets/Square44x44Logo.targetsize-48_altform-lightunplated.png', 'light'],
    ['windows-store/Assets/Square44x44Logo.targetsize-48.png', 'plated'],
  ])('%s -> %s', (path, expected) => {
    expect(variantOf(path)).toBe(expected)
  })

  it('handles the @2x separator macOS tray icons use', () => {
    // The first classifier enumerated its delimiters as `/_-.` and so read
    // `trayTemplate-dark@2x.png` as regular, putting the dark tray icon in the
    // same bucket as the light one.
    expect(variantOf('tray/macos/trayTemplate-dark@2x.png')).toBe('dark')
    expect(variantOf('tray/macos/trayTemplate@2x.png')).toBe('regular')
  })

  it('does not match a variant word buried inside another', () => {
    expect(variantOf('assets/standard-192.png')).toBe('regular')
    expect(variantOf('assets/lightweight-192.png')).toBe('regular')
  })

  it('does not read "background" as a dark variant', () => {
    // `dark` is matched on a delimited word for exactly this: the Android
    // adaptive background layer contains neither "dark" nor anything like it,
    // but a naive substring search over a longer path easily collides.
    expect(variantOf('android/ic_launcher_background.png')).toBe('background')
  })

  it('prefers the specific variant when a path could match two', () => {
    // An Android monochrome layer is also a foreground layer by name.
    expect(variantOf('android/ic_launcher_monochrome_foreground.png')).toBe('mono')
  })
})

/** A PNG header for a non-square image. */
function fakeWidePng(width: number, height: number): Uint8Array {
  const b = fakePng(width)
  b[20] = (height >> 24) & 0xff
  b[21] = (height >> 16) & 0xff
  b[22] = (height >> 8) & 0xff
  b[23] = height & 0xff
  return b
}

describe('groupByVariant', () => {
  it('offers each Windows Store asset family once, at its 100% size', () => {
    // Every scale factor is the same tile resampled. Listing them all put
    // twenty-five chips on the card, and the wide tile's widths collided with the
    // large square tile's.
    const grouped = groupByVariant({
      'windows-store/Assets/Square44x44Logo.scale-100.png': fakePng(44),
      'windows-store/Assets/Square44x44Logo.scale-125.png': fakePng(55),
      'windows-store/Assets/Square44x44Logo.scale-400.png': fakePng(176),
      'windows-store/Assets/Square310x310Logo.scale-100.png': fakePng(310),
      'windows-store/Assets/Wide310x150Logo.scale-100.png': fakeWidePng(310, 150),
      'windows-store/Assets/Square44x44Logo.targetsize-16_altform-unplated.png': fakePng(16),
      'windows-store/Assets/Square44x44Logo.targetsize-16_altform-lightunplated.png': fakePng(16),
      'windows-store/Assets/Square44x44Logo.targetsize-16.png': fakePng(16),
    })
    expect(sizesOf(grouped.get('regular')!)).toEqual([44, 310])
    expect(grouped.get('regular')!.map((i) => i.name)).not.toContainEqual(
      expect.stringContaining('Wide310x150Logo'),
    )
    expect(sizesOf(grouped.get('dark')!)).toEqual([16])
    expect(sizesOf(grouped.get('light')!)).toEqual([16])
    expect(sizesOf(grouped.get('plated')!)).toEqual([16])
  })

  it('skips a non-square render, which is never an icon', () => {
    const grouped = groupByVariant({ 'x/wide.png': fakeWidePng(310, 150), 'x/icon-192.png': fakePng(192) })
    expect(grouped.get('regular')!.map((i) => i.name)).toEqual(['x/icon-192.png'])
  })

  it('separates a PWA export into plain and maskable', () => {
    const grouped = groupByVariant({
      'pwa/icon-192.png': fakePng(192),
      'pwa/icon-512.png': fakePng(512),
      'pwa/icon-maskable-192.png': fakePng(192),
      'pwa/icon-maskable-512.png': fakePng(512),
    })
    expect([...grouped.keys()]).toEqual(['regular', 'maskable'])
    expect(grouped.get('regular')).toHaveLength(2)
    expect(grouped.get('maskable')).toHaveLength(2)
  })

  it('keeps the Android adaptive layers out of the default variant', () => {
    // The regression: previewing `regular` must never yield the bare plate.
    const grouped = groupByVariant({
      'android/ic_launcher_background.png': fakePng(432),
      'android/ic_launcher_foreground.png': fakePng(432),
      'android/mipmap-hdpi/ic_launcher.png': fakePng(72),
      'android/play-store-512.png': fakePng(512),
    })
    const regular = grouped.get('regular')!.map((i) => i.name)
    expect(regular).toEqual(['android/mipmap-hdpi/ic_launcher.png', 'android/play-store-512.png'])
    expect(grouped.has('background')).toBe(true)
  })

  it('orders variants for presentation, not by emission order', () => {
    const grouped = groupByVariant({
      'a/ic_launcher_background.png': fakePng(432),
      'b/icon-maskable-192.png': fakePng(192),
      'c/icon-192.png': fakePng(192),
    })
    const keys = [...grouped.keys()]
    expect(keys).toEqual(['regular', 'maskable', 'background'])
    // And that order is the declared one, so a new variant slots in predictably.
    expect(keys).toEqual(VARIANT_ORDER.filter((v) => keys.includes(v)))
  })

  it('ignores non-PNG output and unreadable bytes', () => {
    const grouped = groupByVariant({
      'favicon.ico': new Uint8Array([0, 0, 1, 0]),
      'apple/AppIcon.icon/icon.json': new Uint8Array([0x7b, 0x7d]),
      'pwa/icon-192.png': fakePng(192),
      'pwa/broken.png': new Uint8Array([1, 2, 3]),
    })
    expect(grouped.get('regular')!.map((i) => i.name)).toEqual(['pwa/icon-192.png'])
  })
})

describe('sizesOf', () => {
  it('reports the sizes a variant actually contains, ascending and deduplicated', () => {
    const icons = [
      { name: 'b', bytes: fakePng(512), size: 512 },
      { name: 'a', bytes: fakePng(192), size: 192 },
      { name: 'c', bytes: fakePng(192), size: 192 },
    ]
    expect(sizesOf(icons)).toEqual([192, 512])
  })
})
