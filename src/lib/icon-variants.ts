/**
 * Grouping a platform's rendered files into the variants a user thinks in.
 *
 * A platform export is not one icon at several sizes. It is several *different
 * icons*: PWA ships a plain and a maskable set, tray ships light and dark,
 * Android ships adaptive layers that are never seen on their own, Windows Store
 * ships plated tiles and unplated taskbar icons.
 *
 * That mattered more than it looked. The preview used to pick "the closest render
 * at or above this size" across the whole file set, which for PWA meant
 * `icon-192.png` and `icon-maskable-192.png` were interchangeable candidates and
 * whichever `Object.entries` yielded first won -- so the preview could silently
 * show the maskable icon while claiming to be the icon. For Android it could show
 * `ic_launcher_background.png`, a solid plate with no artwork on it at all.
 *
 * Variants are derived from the emitted paths rather than hardcoded per platform,
 * so a platform that grows a variant in the core surfaces here without a change.
 */

export type IconVariant =
  | 'regular'
  | 'maskable'
  | 'dark'
  | 'light'
  | 'mono'
  | 'unplated'
  | 'foreground'
  | 'background'

/** Presentation order: the one you meant first, the layers nobody asks for last. */
export const VARIANT_ORDER: IconVariant[] = [
  'regular',
  'maskable',
  'light',
  'dark',
  'mono',
  'unplated',
  'foreground',
  'background',
]

/**
 * Which variant a rendered path belongs to.
 *
 * `dark` is matched on a delimited word so `ic_launcher_background` is not read
 * as a dark variant, and the layer names are checked last because an Android
 * foreground layer can also be the monochrome one.
 */
export function variantOf(path: string): IconVariant {
  const p = path.toLowerCase()
  if (p.includes('maskable')) return 'maskable'
  if (p.includes('unplated')) return 'unplated'
  if (p.includes('mono')) return 'mono'
  // Delimited by "not alphanumeric" rather than an enumerated set: the first
  // version listed `/_-.` and so missed `trayTemplate-dark@2x.png`, macOS's
  // retina tray icon, which then landed in `regular` beside the light one. A
  // lookaround cannot be outrun by the next separator someone picks.
  if (/(?<![a-z0-9])dark(?![a-z0-9])/.test(p)) return 'dark'
  if (/(?<![a-z0-9])light(?![a-z0-9])/.test(p)) return 'light'
  if (p.includes('foreground')) return 'foreground'
  if (p.includes('background')) return 'background'
  return 'regular'
}

export interface RenderedIcon {
  name: string
  bytes: Uint8Array
  /** Pixel width; square, since a non-square render is never an app icon. */
  size: number
}

/** Width from a PNG's IHDR, which always sits at a fixed offset. */
export function pngSize(bytes: Uint8Array): number {
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return 0
  return (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
}

/**
 * Group a platform's render into `{ variant: icons }`, ordered by
 * `VARIANT_ORDER` and with empty variants absent.
 */
export function groupByVariant(files: Record<string, Uint8Array>): Map<IconVariant, RenderedIcon[]> {
  const grouped = new Map<IconVariant, RenderedIcon[]>()

  for (const [name, bytes] of Object.entries(files)) {
    if (!name.toLowerCase().endsWith('.png')) continue
    const size = pngSize(bytes)
    if (size <= 0) continue
    const variant = variantOf(name)
    grouped.set(variant, [...(grouped.get(variant) ?? []), { name, bytes, size }])
  }

  const ordered = new Map<IconVariant, RenderedIcon[]>()
  for (const variant of VARIANT_ORDER) {
    const icons = grouped.get(variant)
    if (icons?.length) ordered.set(variant, icons)
  }
  return ordered
}

/**
 * The render to display at `size` within one variant: the smallest at or above
 * it, so a real render is downscaled rather than a smaller one upscaled. Falls
 * back to the largest available when the variant tops out below `size` (tray
 * icons stop at 48).
 */
export function pickForSize(icons: RenderedIcon[], size: number): RenderedIcon | undefined {
  const atOrAbove = icons.filter((i) => i.size >= size).sort((a, b) => a.size - b.size)
  if (atOrAbove.length) return atOrAbove[0]
  return icons.slice().sort((a, b) => b.size - a.size)[0]
}
