/**
 * How macOS renders an Apple `.icon` bundle, for preview.
 *
 * The Apple export is the one platform where showing the exported file tells you
 * almost nothing. It ships a **transparent foreground** (plus optional
 * light/dark/mono foregrounds) and an `icon.json` that *declares* the plate.
 * macOS composites the two at display time, so the PNG on its own is artwork on
 * checkerboard -- no plate, no shape, no idea whether it reads.
 *
 * So this preview composites the same way the OS does: the real exported layer,
 * over the plate the config declares. That keeps stage one's rule intact -- the
 * pixels are still the exported ones -- while showing the thing the user is
 * actually shipping.
 *
 * The three appearances are macOS's own:
 *
 *   LIGHT   the foreground over `bgFill`
 *   DARK    the foreground over `bgFillDark`, with the dark artwork if a
 *           separate one was exported
 *   TINTED  the monochrome layer over a neutral plate, which is what macOS
 *           renders when the user picks a tinted desktop appearance
 *
 * Each appearance falls back to the plain foreground, because the light, dark
 * and mono layers are only exported when that variant is set to the alternate
 * source -- so most exports have exactly one layer, shown under all three.
 */

import type { IconVariant } from './icon-variants'

export type AppleAppearance = 'light' | 'dark' | 'tinted'

export const APPLE_APPEARANCES: AppleAppearance[] = ['light', 'dark', 'tinted']

/**
 * The plate macOS puts behind a tinted icon. Neutral by design: tinted mode
 * exists to drop an icon's colour, so honouring the configured fill here would
 * show the one thing the appearance removes.
 */
export const TINTED_PLATE = '#333333'

export interface AppleLayer {
  /** Which exported variant to draw, given what the export actually contains. */
  variant: IconVariant
  /** True when the layer should be rendered as a white silhouette. */
  monochrome: boolean
}

/**
 * Which exported layer an appearance draws, falling back to the plain
 * foreground when the export has no dedicated one.
 */
export function appleLayerFor(
  appearance: AppleAppearance,
  available: IconVariant[],
): AppleLayer {
  const has = (v: IconVariant) => available.includes(v)

  if (appearance === 'tinted') {
    // The mono layer is already drawn to be a silhouette. Tinting the colour
    // foreground is the fallback, and it is a fair approximation of what macOS
    // does when an icon ships no mono layer.
    return has('mono')
      ? { variant: 'mono', monochrome: true }
      : { variant: fallback(available), monochrome: true }
  }

  if (appearance === 'dark' && has('dark')) return { variant: 'dark', monochrome: false }
  if (appearance === 'light' && has('light')) return { variant: 'light', monochrome: false }

  return { variant: fallback(available), monochrome: false }
}

/**
 * The layer to draw when the appearance has no dedicated one. `regular` is the
 * always-exported `foreground.png`; the first available variant covers the case
 * where a future export drops it.
 */
function fallback(available: IconVariant[]): IconVariant {
  return available.includes('regular') ? 'regular' : (available[0] ?? 'regular')
}
