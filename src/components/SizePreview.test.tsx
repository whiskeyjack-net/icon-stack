/**
 * The preview's contract with the OS-mask rules.
 *
 * `os-mask.test.ts` pins what the rules SAY; this pins that the component
 * actually applies them, which is a different failure. A correct rule table that
 * never reaches a style attribute looks identical from the unit tests.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'

/** A minimal valid PNG header carrying a square size in its IHDR. */
function fakePng(size: number): Uint8Array {
  const b = new Uint8Array(24)
  b[0] = 0x89
  b[1] = 0x50
  for (const offset of [16, 20]) {
    b[offset] = (size >> 24) & 0xff
    b[offset + 1] = (size >> 16) & 0xff
    b[offset + 2] = (size >> 8) & 0xff
    b[offset + 3] = size & 0xff
  }
  return b
}

const files: Record<string, Record<string, Uint8Array>> = {
  macos: {
    'macos/icon_16x16.png': fakePng(16),
    'macos/icon_32x32.png': fakePng(32),
    'macos/icon_512x512@2x.png': fakePng(1024),
  },
  windows: {
    'windows/icon-32.png': fakePng(32),
    'windows/icon-256.png': fakePng(256),
  },
  // The Apple export is a transparent foreground plus a declared plate, which
  // is why the preview composites rather than showing the file flat.
  apple: {
    'apple/AppIcon.icon/Assets/foreground.png': fakePng(1024),
  },
}

vi.mock('@/contexts/GeneratorContext', () => ({
  useGenerator: () => ({
    source: { name: 'mark.png' },
    platforms: {
      apple: {
        bgFill: { type: 'solid', color: '#FFCC00' },
        bgFillDark: { type: 'solid', color: '#102030' },
      },
    },
    alternate: {},
    render: (platform: string) => Promise.resolve(files[platform] ?? {}),
  }),
}))

const { SizePreview } = await import('./SizePreview')

beforeAll(() => {
  // jsdom implements neither, and the preview builds one URL per size.
  globalThis.URL.createObjectURL ??= () => 'blob:preview'
  globalThis.URL.revokeObjectURL ??= () => {}
})

describe('SizePreview', () => {
  it('rounds a macOS icon the way macOS rounds it, and says the file is square', async () => {
    render(<SizePreview platform="macos" />)

    const hero = await screen.findByAltText('Icon rendered at 1024 pixels')
    // The mask sits on the clipping wrapper rather than the image, so that an
    // Apple plate drawn behind the artwork is cropped to the same shape.
    expect(hero.parentElement).toHaveStyle({ borderRadius: '22.37%' })

    // The caption is load-bearing: a rounded preview with no note reads as a
    // claim that the exported PNG is rounded.
    expect(screen.getByText(/stays square/i)).toBeInTheDocument()
  })

  it('scales the hero down while naming the real pixel size', async () => {
    render(<SizePreview platform="macos" />)

    const hero = await screen.findByAltText('Icon rendered at 1024 pixels')
    expect(hero).toHaveAttribute('width', '208')
    expect(screen.getByText(/1024px/)).toBeInTheDocument()
  })

  it('shows the small end at 1:1, only at sizes the export contains', async () => {
    render(<SizePreview platform="macos" />)

    const small = await screen.findByAltText('Icon rendered at 16 pixels')
    expect(small).toHaveAttribute('width', '16')
    expect(screen.getByAltText('Icon rendered at 32 pixels')).toHaveAttribute('width', '32')

    // 64 and 128 are absent from this export. The previous implementation
    // invented them by letting the browser shrink a bigger render, which is the
    // one thing the component's own doc comment said it would not do.
    expect(screen.queryByAltText('Icon rendered at 64 pixels')).toBeNull()
    expect(screen.queryByAltText('Icon rendered at 128 pixels')).toBeNull()
  })

  it('composites the Apple plate the export never bakes, and swaps it per appearance', async () => {
    const user = userEvent.setup()
    render(<SizePreview platform="apple" />)

    const hero = await screen.findByAltText('Icon rendered at 1024 pixels')
    // Light appearance draws the configured plate behind the transparent layer.
    expect(hero.parentElement).toHaveStyle({ background: '#FFCC00' })

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await waitFor(() => expect(hero.parentElement).toHaveStyle({ background: '#102030' }))

    // Tinted drops the icon's colour entirely, which is the appearance's point,
    // so neither configured fill applies.
    await user.click(screen.getByRole('radio', { name: 'Tinted' }))
    await waitFor(() => expect(hero.parentElement).toHaveStyle({ background: '#333333' }))
    expect(hero).toHaveStyle({ filter: 'brightness(0) invert(1)' })
  })

  it('makes the Apple icon circular for the watch, whatever the desktop does', async () => {
    const user = userEvent.setup()
    render(<SizePreview platform="apple" />)

    const hero = await screen.findByAltText('Icon rendered at 1024 pixels')
    expect(hero.parentElement).toHaveStyle({ borderRadius: '22.37%' })

    await user.click(screen.getByRole('button', { name: /watch/i }))
    await waitFor(() => expect(hero.parentElement).toHaveStyle({ borderRadius: '50%' }))
  })

  it('leaves a Windows icon square, because its corner is already in the pixels', async () => {
    render(<SizePreview platform="windows" />)

    const hero = await screen.findByAltText('Icon rendered at 256 pixels')
    expect(hero.parentElement!.style.borderRadius).toBe('')

    await waitFor(() => expect(screen.queryByText(/stays square/i)).toBeNull())
  })
})
