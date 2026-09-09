/**
 * Grouping a platform's rendered files into the variants a user thinks in.
 *
 * A platform export is not one icon at several sizes. It is several *different
 * icons*: PWA ships a plain and a maskable set, tray ships light and dark,
 * Android ships adaptive layers that are never seen on their own, Windows Store
 * ships plated tiles and bare taskbar icons for a dark and a light taskbar.
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

import { decodeIco } from '@whiskeyjack-net/icon-stack-core'

export type IconVariant =
  | 'regular'
  | 'maskable'
  | 'dark'
  | 'light'
  | 'mono'
  | 'plated'
  | 'foreground'
  | 'background'

/** Presentation order: the one you meant first, the layers nobody asks for last. */
export const VARIANT_ORDER: IconVariant[] = [
  'regular',
  'maskable',
  'light',
  'dark',
  'mono',
  'plated',
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
  // A Windows Store target-size icon ships three times. The two bare ones are
  // what the taskbar shows in its dark and light themes, so they ARE that
  // platform's dark and light variants. The plain one is put on an accent plate
  // by Windows itself and has no toggle of its own; see SizePreview.
  if (p.includes('targetsize')) {
    if (p.includes('lightunplated')) return 'light'
    if (p.includes('unplated')) return 'dark'
    return 'plated'
  }
  if (p.includes('maskable')) return 'maskable'
  // iOS 18's tinted icon is the grayscale image the system tints, which is the
  // same thing the monochrome toggle means everywhere else.
  if (p.includes('mono') || /(?<![a-z0-9])tinted(?![a-z0-9])/.test(p)) return 'mono'
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
  /** PNG bytes, whatever container the render arrived in. */
  bytes: Uint8Array
  /** Pixel width; square, since a non-square render is never an app icon. */
  size: number
}

/** Dimensions from a PNG's IHDR, which always sits at a fixed offset. */
export function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return { width: 0, height: 0 }
  const u32 = (o: number) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0
  return { width: u32(16), height: u32(20) }
}

/**
 * `Square44x44Logo.scale-125.png` is `Square44x44Logo.scale-100.png` at another
 * density: the same artwork, resampled. Previewing every scale put twenty-five
 * size chips on the Windows Store card, most of them the same tile again, so
 * only the 100% asset of each family is offered.
 */
const DENSITY_SUFFIX = /\.scale-(\d+)\.png$/

function isDensityDuplicate(lowerName: string): boolean {
  const m = lowerName.match(DENSITY_SUFFIX)
  return m !== null && m[1] !== '100'
}

/**
 * A DIB frame as PNG bytes, so the preview can show it with the same `<img>` as
 * every other render. The ICO encoder stores frames under 256px uncompressed,
 * which is what Windows wants and what a browser cannot display with alpha.
 * `null` where there is no 2D context to draw with, and the frame is skipped.
 */
function rgbaToPng(rgba: Uint8ClampedArray, size: number): Uint8Array | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = ctx.createImageData(size, size)
  image.data.set(rgba)
  ctx.putImageData(image, 0, 0)
  const base64 = canvas.toDataURL('image/png').split(',')[1] ?? ''
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/**
 * Group a platform's render into `{ variant: icons }`, ordered by
 * `VARIANT_ORDER` and with empty variants absent.
 */
export function groupByVariant(files: Record<string, Uint8Array>): Map<IconVariant, RenderedIcon[]> {
  const grouped = new Map<IconVariant, RenderedIcon[]>()

  const add = (name: string, bytes: Uint8Array, size: number) => {
    if (size <= 0) return
    const variant = variantOf(name)
    grouped.set(variant, [...(grouped.get(variant) ?? []), { name, bytes, size }])
  }

  for (const [name, bytes] of Object.entries(files)) {
    const lower = name.toLowerCase()
    if (isDensityDuplicate(lower)) continue

    // Two platforms export nothing else. `windows` ships only `app.ico` and
    // `favicon` only `favicon.ico`, so skipping containers meant both showed
    // "no raster sizes" -- a strange thing for an icon generator to say about
    // icons it had just produced. Each embedded frame is a real render at a real
    // size, which is exactly what this preview wants.
    if (lower.endsWith('.ico')) {
      for (const frame of decodeIco(bytes)) {
        const png = frame.kind === 'png' ? frame.pngData : rgbaToPng(frame.rgba, frame.size)
        if (png) add(`${name}@${frame.size}`, png, frame.size)
      }
      continue
    }

    if (!lower.endsWith('.png')) continue
    const { width, height } = pngDimensions(bytes)
    // A wide tile is a tile, not an icon: squeezed into a square box it would
    // preview as a distortion of something the export got right.
    if (width !== height) continue
    add(name, bytes, width)
  }

  const ordered = new Map<IconVariant, RenderedIcon[]>()
  for (const variant of VARIANT_ORDER) {
    const icons = grouped.get(variant)
    if (icons?.length) ordered.set(variant, icons)
  }
  return ordered
}

/**
 * The distinct sizes a variant actually contains, ascending.
 *
 * Derived from the render rather than a per-platform table, for the same reason
 * the variants are: the retired app carried a hardcoded `PLATFORM_SIZES` map
 * with a comment saying it was "derived from platform-configs.ts", which is a
 * hand-copy waiting to drift. A size added or dropped in the core shows up here
 * with no change.
 */
export function sizesOf(icons: RenderedIcon[]): number[] {
  return [...new Set(icons.map((i) => i.size))].sort((a, b) => a - b)
}

/**
 * The largest size worth showing at 1:1. Above this a preview stops being about
 * legibility -- nobody squints at a 512px icon wondering if the mark reads -- and
 * starts being about shape and composition, which one larger render answers
 * better than a row of them.
 */
export const LEGIBILITY_MAX = 128
