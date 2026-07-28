/**
 * Default platform configuration.
 *
 * Lived in the web app's GeneratorContext, which made it unreachable to any
 * other consumer. The CLI needs exactly the same defaults, so it belongs beside
 * the generator -- one definition of "a sensible full icon set".
 */
import type { Platform, PlatformConfigs } from './types'

const WHITE_FILL = { type: 'solid' as const, color: '#FFFFFF' }
const BLACK_FILL = { type: 'solid' as const, color: '#000000' }

export function createDefaultPlatforms(): PlatformConfigs {
  const base = {
    enabled: true,
    bgFill: WHITE_FILL,
    bgTransparent: false,
    zoom: 100,
    cornerRadius: 0,
    cornerSmoothing: 0,
    sourceChoice: 'main' as const,
  }

  const darkVariant = {
    ...base,
    bgFillDark: BLACK_FILL,
    darkSourceChoice: 'main' as const,
  }

  return {
    apple: {
      enabled: true,
      bgFill: WHITE_FILL,
      bgFillDark: BLACK_FILL,
      lightSourceChoice: 'main' as const,
      darkSourceChoice: 'main' as const,
      monoSourceChoice: 'main' as const,
      glass: false,
      shadow: { kind: 'neutral' as const, opacity: 0.5 },
      translucency: { enabled: true, value: 0.5 },
      zoom: 100,
    },
    android: { ...base, useMonochrome: false, monoSourceChoice: 'main' as const },
    windows: { ...base, bgTransparent: true },
    // Store tiles are always transparent (the MSIX manifest supplies the plate
    // color). Enabled by default so a full icon set includes the Store tiles.
    // `sourceChoice` = tile source (main); `unplatedSourceChoice` = taskbar-icon
    // source (alternate). `bgFill` is a preview-only plate color.
    windowsStore: {
      ...base,
      bgTransparent: true,
      unplatedSourceChoice: 'alternate' as const,
      unplatedTransparent: true,
      unplatedBgFill: WHITE_FILL,
      unplatedZoom: 100,
    },
    linux: { ...base, bgTransparent: true },
    pwa: {
      ...base,
      bgTransparent: true,
      maskableSourceChoice: 'main' as const,
      maskableBgFill: WHITE_FILL,
      maskableZoom: 100,
    },
    favicon: {
      ...base,
      bgTransparent: true,
      faviconSource: null,
      includeSvg: true,
      svgDarkMode: false,
    },
    appleTouchIcon: { ...base },
    trayIcon: { ...base, bgTransparent: true, traySource: null, enabled: false },
    macos: { ...darkVariant, enabled: false },
    ios: { ...darkVariant, enabled: false },
  }
}

/**
 * Apply a patch to one platform's config, returning a new `PlatformConfigs`.
 *
 * Exists because writing `configs[key] = {...}` where `key` is a `Platform`
 * union does not type-check: TypeScript requires the value to satisfy the
 * INTERSECTION of every config shape (`AppleConfig & AndroidConfig & ...`),
 * which no single config does. The generic `K` pins the key to one platform, so
 * the patch is checked against that platform's own type and nothing else.
 *
 * Without it, every consumer reaches for `Object.assign` or a cast.
 */
export function updatePlatform<K extends Platform>(
  configs: PlatformConfigs,
  platform: K,
  patch: Partial<PlatformConfigs[K]>,
): PlatformConfigs {
  return { ...configs, [platform]: { ...configs[platform], ...patch } }
}

/**
 * Enable exactly the named platforms and disable the rest, preserving every
 * other setting. The common shape of "generate only what is selected".
 */
export function selectPlatforms(
  configs: PlatformConfigs,
  enabled: readonly Platform[],
): PlatformConfigs {
  // Rebuilt as entries rather than assigned key by key: a loop write hits the
  // same union-intersection problem described above. `Object.fromEntries` loses
  // the mapped type, so there is one assertion here -- deliberately, since
  // absorbing it once is the entire reason this helper exists.
  const entries = (Object.keys(configs) as Platform[]).map(
    (key) => [key, { ...configs[key], enabled: enabled.includes(key) }] as const,
  )
  return Object.fromEntries(entries) as PlatformConfigs
}
