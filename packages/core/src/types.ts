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
  sourceChoice: SourceChoice
}

/**
 * A platform whose export DRAWS the corner into the PNG.
 *
 * Deliberately not on `PlatformConfig`. It was, and the result was that ten
 * platforms carried these two fields while the pipeline read them on five: the app
 * rendered a corner-radius slider for Android, Apple Touch, tray and legacy iOS
 * that moved and changed nothing at all.
 *
 * The platforms left out are the ones where the OS supplies the shape. iOS and
 * Apple Touch icons are masked by the system, so a baked corner is cut a second
 * time and shows inside the mask; an Android adaptive icon is composited and
 * masked by the launcher; a tray icon is a 16-22px template silhouette where a
 * corner radius means nothing. A legacy `.icns` is the exception and keeps them,
 * because there the artwork IS the icon's shape -- nothing masks it.
 */
export interface RoundedCornersConfig extends PlatformConfig {
  /** 0-50, as a percentage of the icon's width. 0 leaves it square. */
  cornerRadius: number
  /**
   * Corner smoothing 0-100: 0 = classic circular rounded corners, higher blends
   * toward a superellipse (squircle) corner. Only meaningful when
   * `cornerRadius > 0` and the background is not transparent -- the radius clips
   * the baked plate, so with nothing baked there is nothing to clip.
   */
  cornerSmoothing: number
}

/** macOS and iOS support separate dark mode icon variants */
export interface DarkVariantConfig extends PlatformConfig {
  bgFillDark: BackgroundFill
  darkSourceChoice: SourceChoice
}

/**
 * Legacy macOS: a dark variant AND baked corners.
 *
 * It is the one OS-shaped platform that still rounds its own artwork, because a
 * `.icns` is not masked -- the image is the icon's silhouette. Legacy iOS shares
 * the dark variant and not the corners, which is why these are two interfaces.
 */
export interface MacosConfig extends DarkVariantConfig {
  cornerRadius: number
  cornerSmoothing: number
}

export interface AndroidConfig extends PlatformConfig {
  useMonochrome: boolean
  monoSourceChoice: SourceChoice
}

export interface FaviconConfig extends RoundedCornersConfig {
  faviconSource: SourceImage | null
  includeSvg: boolean
  svgDarkMode: boolean
}

export interface PwaConfig extends RoundedCornersConfig {
  maskableSourceChoice: SourceChoice
  maskableBgFill: BackgroundFill
  maskableZoom: number
}

export interface TrayIconConfig extends PlatformConfig {
  traySource: SourceImage | null
}

export interface WindowsStoreConfig extends RoundedCornersConfig {
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
  windows: RoundedCornersConfig
  windowsStore: WindowsStoreConfig
  linux: RoundedCornersConfig
  pwa: PwaConfig
  favicon: FaviconConfig
  appleTouchIcon: PlatformConfig
  trayIcon: TrayIconConfig
  macos: MacosConfig
  ios: DarkVariantConfig
}

export interface GeneratorState {
  source: SourceImage | null
  platforms: PlatformConfigs
  generating: boolean
  progress: number
}
