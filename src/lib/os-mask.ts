/**
 * The shape an OS imposes on an icon at display time.
 *
 * An app icon is almost never shown as the square you exported. macOS and iOS
 * round it to a squircle, Android's launcher crops an adaptive icon to whatever
 * shape the device uses, and a PWA's maskable icon is cropped by the installer.
 * A preview that shows the flat square is showing something the user will never
 * see, and it hides the failure this app exists to catch: artwork that runs into
 * the corners and gets sliced off.
 *
 * ## Why there is no "baked corner" branch here
 *
 * Rounding reaches an icon two different ways, and only one of them belongs in
 * a preview:
 *
 *   BAKED    Windows, Linux and favicon exports draw the corner radius into the
 *            PNG itself, from the platform's `cornerRadius` setting.
 *   APPLIED  Apple and Android leave the file square and round it themselves.
 *
 * This preview renders the **real exported bytes**, so a baked corner is already
 * in the pixels and simulating it would round an already-rounded image twice.
 * The retired monorepo version drew previews on a canvas instead, so it had to
 * reproduce every baked-corner condition from the export code to stay truthful;
 * that function existed only to compensate for not showing the real file.
 *
 * So this module answers one question: what does the OS do on top?
 */

import type { Platform } from '@whiskeyjack-net/icon-stack-core'
import type { IconVariant } from './icon-variants'

/**
 * Border-radius, as a CSS percentage, that the platform applies at display time.
 *
 * 22.37% is the long-standing approximation of Apple's squircle. It is a rounded
 * rectangle rather than a true superellipse, so it is slightly wrong at the
 * corners' shoulders -- close enough to judge whether artwork survives the crop,
 * which is what a preview is for.
 */
const OS_APPLIED: Partial<Record<Platform, string>> = {
  apple: '22.37%',
  macos: '22.37%',
  ios: '22.37%',
  appleTouchIcon: '22.37%',
  android: '50%',
  pwa: '50%',
}

/**
 * Android ships adaptive layers that a launcher composites *before* masking.
 * Masking one on its own would show a circular foreground floating on nothing,
 * which is not a state any device renders.
 */
const UNCOMPOSITED_LAYERS: IconVariant[] = ['foreground', 'background', 'mono']

export interface OsMask {
  /** CSS `border-radius` value, or `null` when the platform shows it square. */
  radius: string | null
}

/**
 * What the OS does to this platform's icon, for this variant.
 *
 * Returns no mask when the file is displayed as-is. Callers should say so in the
 * caption when a mask IS applied, because the exported file stays square and a
 * user comparing the preview against the PNG would otherwise think the export
 * had rounded it.
 */
export function osMaskFor(platform: Platform, variant: IconVariant): OsMask {
  const radius = OS_APPLIED[platform]
  if (!radius) return { radius: null }

  // A maskable icon is full-bleed art *designed* to be cropped, so the crop is
  // the whole point of previewing it. A plain PWA icon is used as-is in plenty
  // of places (a tab, a task switcher), so cropping it would invent a constraint.
  if (platform === 'pwa' && variant !== 'maskable') return { radius: null }

  if (platform === 'android' && UNCOMPOSITED_LAYERS.includes(variant)) return { radius: null }

  return { radius }
}
