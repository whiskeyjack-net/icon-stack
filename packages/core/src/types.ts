export interface SourceImage {
  type: 'png' | 'svg'
  /**
   * Data URL. Stays a plain string rather than a `string | Uint8Array` union:
   * the browser produces one naturally, Node builds one from file bytes, and a
   * union would force a narrowing cast at every UI call site that feeds an
   * <img src>. Base64 of an icon source is negligible.
   */
  dataUrl: string
  width: number
  height: number
  /**
   * Raw SVG markup, for the favicon SVG passthrough. Only set for `type: 'svg'`.
   * Previously read via `File.text()`, which tied the core to the browser.
   */
  svgText?: string
  /**
   * Original filename, for UI display. A plain string rather than a browser
   * `File` so the type stays host-agnostic -- the CLI has a path, not a File.
   */
  fileName?: string
}

export type SourceChoice = 'main' | 'alternate'

export type ImageFit = 'contain' | 'cover'

export interface GradientFill {
  topColor: string // hex color, or 'auto' for automatic lighter shade of bottomColor
  bottomColor: string // hex color
}

export type BackgroundFill =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; gradient: GradientFill }

export interface PlatformConfig {
  enabled: boolean
  bgFill: BackgroundFill
  bgTransparent: boolean
  zoom: number
  cornerRadius: number
  /**
   * Corner smoothing 0-100: 0 = classic circular rounded corners, higher blends
   * toward a superellipse (squircle) corner. Only meaningful when
   * `cornerRadius > 0` on a baked-background platform.
   */
  cornerSmoothing: number
  sourceChoice: SourceChoice
}

/** macOS and iOS support separate dark mode icon variants */
export interface DarkVariantConfig extends PlatformConfig {
  bgFillDark: BackgroundFill
  darkSourceChoice: SourceChoice
}

export interface AndroidConfig extends PlatformConfig {
  useMonochrome: boolean
  monoSourceChoice: SourceChoice
}

export interface FaviconConfig extends PlatformConfig {
  faviconSource: SourceImage | null
  includeSvg: boolean
  svgDarkMode: boolean
}

export interface PwaConfig extends PlatformConfig {
  maskableSourceChoice: SourceChoice
  maskableBgFill: BackgroundFill
  maskableZoom: number
}

export interface TrayIconConfig extends PlatformConfig {
  traySource: SourceImage | null
}

export interface WindowsStoreConfig extends PlatformConfig {
  /** Source for the unplated (taskbar) icons. `sourceChoice` is the tile source. */
  unplatedSourceChoice: SourceChoice
  /**
   * `bgFill` is a PREVIEW-ONLY plate color for the tiles: the exported tile
   * PNGs stay transparent (the real plate color is the MSIX manifest's
   * BackgroundColor). The fields below control the unplated (taskbar) icons'
   * background, which -- unlike the tiles -- IS baked into the exported PNGs
   * (transparent by default). Inherited `zoom` scales the TILE logos; inherited
   * `cornerRadius` rounds the unplated icons' baked background (tiles stay
   * square, floating transparent on the plate).
   */
  unplatedTransparent: boolean
  unplatedBgFill: BackgroundFill
  /** Zoom for the unplated (taskbar) logos; `zoom` scales the tile logos. */
  unplatedZoom: number
}

export interface AppleConfig {
  enabled: boolean
  bgFill: BackgroundFill
  bgFillDark: BackgroundFill
  lightSourceChoice: SourceChoice
  darkSourceChoice: SourceChoice
  monoSourceChoice: SourceChoice
  glass: boolean
  shadow: { kind: 'neutral'; opacity: number }
  translucency: { enabled: boolean; value: number }
  zoom: number
}

export type Platform =
  | 'apple'
  | 'android'
  | 'windows'
  | 'windowsStore'
  | 'linux'
  | 'pwa'
  | 'favicon'
  | 'appleTouchIcon'
  | 'trayIcon'
  | 'macos'
  | 'ios'

export const PLATFORM_LABELS: Record<Platform, string> = {
  apple: 'Apple',
  android: 'Android',
  windows: 'Windows',
  windowsStore: 'Windows Store',
  linux: 'Linux',
  pwa: 'PWA',
  favicon: 'Favicon',
  appleTouchIcon: 'Apple Touch Icon',
  trayIcon: 'Tray Icon',
  macos: 'macOS (Legacy)',
  ios: 'iOS (Legacy)',
}

export interface PlatformSizeEntry {
  width: number
  height: number
  filename: string
  folder: string
}

export type PlatformConfigs = {
  apple: AppleConfig
  android: AndroidConfig
  windows: PlatformConfig
  windowsStore: WindowsStoreConfig
  linux: PlatformConfig
  pwa: PwaConfig
  favicon: FaviconConfig
  appleTouchIcon: PlatformConfig
  trayIcon: TrayIconConfig
  macos: DarkVariantConfig
  ios: DarkVariantConfig
}

export interface GeneratorState {
  source: SourceImage | null
  platforms: PlatformConfigs
  generating: boolean
  progress: number
}
