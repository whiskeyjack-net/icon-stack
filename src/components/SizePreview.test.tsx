/**
 * What the preview shows, and what it refuses to show.
 *
 * `os-mask.test.ts` and `apple-appearance.test.ts` pin what the rules SAY; this
 * pins that the component applies them, which is a different failure -- a correct
 * rule table that never reaches a style attribute looks identical from the unit
 * tests.
 *
 * The platform configs come from the core's own `createDefaultPlatforms()` rather
 * than hand-written stubs. A stub is how the previous version of this file came to
 * assert against `windows/icon-32.png`, a path the CLI has never emitted, while
 * the real Windows preview showed nothing at all.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createDefaultPlatforms, encodeIco } from '@whiskeyjack-net/icon-stack-core'
import { COMPACT_CONTROL_HEIGHT, compactControlClass } from '@whiskeyjack-net/design-system'
import '@/i18n'

/**
 * A minimal valid PNG header carrying a square size in its IHDR.
 *
 * All four magic bytes: the ICO decoder identifies an embedded image by the full
 * signature, so a half-stamped header decodes as "not a PNG" and is skipped.
 */
function fakePng(size: number): Uint8Array {
  const b = new Uint8Array(24)
  b[0] = 0x89
  b[1] = 0x50
  b[2] = 0x4e
  b[3] = 0x47
  for (const offset of [16, 20]) {
    b[offset] = (size >> 24) & 0xff
    b[offset + 1] = (size >> 16) & 0xff
    b[offset + 2] = (size >> 8) & 0xff
    b[offset + 3] = size & 0xff
  }
  return b
}

/** Paths as the CLI actually writes them. */
const files: Record<string, Record<string, Uint8Array>> = {
  macos: {
    'macos/icon_16x16.png': fakePng(16),
    'macos/icon_128x128.png': fakePng(128),
    'macos/icon_512x512@2x.png': fakePng(1024),
  },
  // One file, and no PNG in it. Both Windows and favicon ship only a container.
  windows: {
    'windows/app.ico': encodeIco(
      [16, 32, 256].map((size) => ({ size, pngData: fakePng(size) })),
    ),
  },
  favicon: {
    'favicon.ico': encodeIco([16, 32].map((size) => ({ size, pngData: fakePng(size) }))),
  },
  // A transparent foreground plus a plate declared in icon.json.
  apple: {
    'apple/AppIcon.icon/Assets/foreground.png': fakePng(1024),
  },
  // The finalized icon, plus the adaptive layers a launcher composites and the
  // monochrome layer Android 13+ can request.
  android: {
    'android/mipmap-hdpi/ic_launcher.png': fakePng(72),
    'android/play-store-512.png': fakePng(512),
    'android/ic_launcher_foreground.png': fakePng(432),
    'android/ic_launcher_background.png': fakePng(432),
    'android/ic_launcher_monochrome.png': fakePng(432),
  },
}

const platforms = createDefaultPlatforms() as unknown as Record<string, unknown>
;(platforms.apple as Record<string, unknown>).bgFill = { type: 'solid', color: '#FFCC00' }
;(platforms.apple as Record<string, unknown>).bgFillDark = { type: 'solid', color: '#102030' }

vi.mock('@/contexts/GeneratorContext', () => ({
  useGenerator: () => ({
    source: { name: 'mark.png' },
    platforms,
    alternate: null,
    render: (platform: string) => Promise.resolve(files[platform] ?? {}),
  }),
}))

const { SizePreview } = await import('./SizePreview')

beforeAll(() => {
  globalThis.URL.createObjectURL ??= () => 'blob:preview'
  globalThis.URL.revokeObjectURL ??= () => {}
})

const icon = (size: number, platform: string) =>
  screen.findByAltText(`${size}×${size} ${platform} icon preview`)

describe('SizePreview', () => {
  it('offers the exported sizes and previews one at a time', async () => {
    const user = userEvent.setup()
    render(<SizePreview platform="macos" />)

    // The largest is shown first, and every size the export contains is offered.
    await icon(1024, 'macOS (Legacy)')
    for (const size of [16, 128, 1024]) {
      expect(screen.getByRole('button', { name: String(size) })).toBeInTheDocument()
    }
    // Sizes the export does not contain are absent rather than interpolated.
    expect(screen.queryByRole('button', { name: '64' })).toBeNull()

    await user.click(screen.getByRole('button', { name: '16' }))
    await icon(16, 'macOS (Legacy)')
    expect(screen.queryByAltText(/1024×1024/)).toBeNull()
  })

  it('draws the small end pixelated, so smoothing cannot flatter it', async () => {
    const user = userEvent.setup()
    render(<SizePreview platform="macos" />)

    const large = await icon(1024, 'macOS (Legacy)')
    expect(large).toHaveStyle({ imageRendering: 'auto' })

    await user.click(screen.getByRole('button', { name: '16' }))
    expect(await icon(16, 'macOS (Legacy)')).toHaveStyle({ imageRendering: 'pixelated' })
  })

  it('rounds a macOS icon the way macOS rounds it, and says the file is square', async () => {
    render(<SizePreview platform="macos" />)

    const hero = await icon(1024, 'macOS (Legacy)')
    // The mask sits on the clipping wrapper so an Apple plate is cropped with it.
    expect(hero.parentElement).toHaveStyle({ borderRadius: '22.37%' })
    expect(screen.getByText(/preview only/i)).toBeInTheDocument()
  })

  it('shows Android its finalized icon, and never an adaptive layer', async () => {
    render(<SizePreview platform="android" />)

    await icon(512, 'Android')
    // The layers are inputs. A launcher composites them and masks the result, so
    // a foreground alone is a state no device renders.
    expect(screen.queryByRole('radio', { name: /foreground/i })).toBeNull()
    expect(screen.queryByRole('radio', { name: /background/i })).toBeNull()
    // 432 is the layers' size and belongs to no offered variant.
    expect(screen.queryByRole('button', { name: '432' })).toBeNull()
  })

  it('offers Android monochrome as a toggle beside the real icon', async () => {
    const user = userEvent.setup()
    render(<SizePreview platform="android" />)

    await icon(512, 'Android')
    const monoToggle = screen.getByRole('button', { name: /monochrome/i })
    expect(monoToggle).toHaveAttribute('aria-pressed', 'false')

    await user.click(monoToggle)
    await waitFor(() => expect(monoToggle).toHaveAttribute('aria-pressed', 'true'))
    // The mono layer is 432, which the finalized icon's size list does not carry.
    await icon(432, 'Android')
  })

  it('composites the Apple plate the export never bakes, and swaps it per appearance', async () => {
    const user = userEvent.setup()
    render(<SizePreview platform="apple" />)

    const hero = await icon(1024, 'Apple')
    expect(hero.parentElement).toHaveStyle({ background: '#FFCC00' })

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await waitFor(() => expect(hero.parentElement).toHaveStyle({ background: '#102030' }))

    // Tinted drops the icon's colour, which is the appearance's whole point, so
    // neither configured fill applies.
    await user.click(screen.getByRole('radio', { name: 'Tinted' }))
    await waitFor(() => expect(hero.parentElement).toHaveStyle({ background: '#333333' }))
    expect(hero).toHaveStyle({ filter: 'brightness(0) invert(1)' })
  })

  it('makes the Apple icon circular for the watch, whatever the desktop does', async () => {
    const user = userEvent.setup()
    render(<SizePreview platform="apple" />)

    const hero = await icon(1024, 'Apple')
    expect(hero.parentElement).toHaveStyle({ borderRadius: '22.37%' })

    await user.click(screen.getByRole('button', { name: /watch/i }))
    await waitFor(() => expect(hero.parentElement).toHaveStyle({ borderRadius: '50%' }))
  })

  it('opens the ICO the Windows export ships instead of showing nothing', async () => {
    render(<SizePreview platform="windows" />)

    // `windows` emits app.ico and no PNG at all, so a preview that only read
    // PNGs said "no raster sizes" about icons it had just generated.
    await icon(256, 'Windows')
    for (const size of [16, 32, 256]) {
      expect(screen.getByRole('button', { name: String(size) })).toBeInTheDocument()
    }
    expect(screen.queryByText(/no raster sizes/i)).toBeNull()
  })

  it('leaves a Windows icon square, and claims no OS mask for it', async () => {
    render(<SizePreview platform="windows" />)

    const hero = await icon(256, 'Windows')
    expect(hero.parentElement!.style.borderRadius).toBe('')
    await waitFor(() => expect(screen.queryByText(/preview only/i)).toBeNull())
  })

  it('lines up every control in the row, from the design system recipe', async () => {
    // Apple's row is the busiest: size chips, an appearance strip and the watch
    // pill. They had each grown their own padding and sat at three heights, which
    // reads as a rendering fault rather than a design.
    const { container } = render(<SizePreview platform="apple" />)
    await icon(1024, 'Apple')

    const chip = screen.getByRole('button', { name: '1024' })
    const strip = container.querySelector('[role="radiogroup"]')!
    const pill = screen.getByRole('button', { name: /watch/i })

    for (const el of [chip, strip, pill]) {
      expect(el.className, el.textContent ?? '').toContain(COMPACT_CONTROL_HEIGHT)
    }

    // Height comes from the shared recipe rather than three local guesses, so a
    // future control matches by construction.
    expect(compactControlClass()).toContain(COMPACT_CONTROL_HEIGHT)
  })

  it('opens favicon.ico too', async () => {
    render(<SizePreview platform="favicon" />)

    await icon(32, 'Favicon')
    expect(screen.getByRole('button', { name: '16' })).toBeInTheDocument()
  })
})
