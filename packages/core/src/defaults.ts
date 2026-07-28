/**
 * Default platform configuration.
 *
 * Lived in the web app's GeneratorContext, which made it unreachable to any
 * other consumer. The CLI needs exactly the same defaults, so it belongs beside
 * the generator -- one definition of "a sensible full icon set".
 */
import type { PlatformConfigs } from './types'

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
