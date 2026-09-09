import type { PlatformSizeEntry } from './types'

// macOS .icns – 10 images (5 logical sizes × @1x + @2x)
export const MACOS_SIZES: PlatformSizeEntry[] = [
  { width: 16, height: 16, filename: 'icon_16x16.png', folder: 'macos/AppIcon.iconset' },
  { width: 32, height: 32, filename: 'icon_16x16@2x.png', folder: 'macos/AppIcon.iconset' },
  { width: 32, height: 32, filename: 'icon_32x32.png', folder: 'macos/AppIcon.iconset' },
  { width: 64, height: 64, filename: 'icon_32x32@2x.png', folder: 'macos/AppIcon.iconset' },
  { width: 128, height: 128, filename: 'icon_128x128.png', folder: 'macos/AppIcon.iconset' },
  { width: 256, height: 256, filename: 'icon_128x128@2x.png', folder: 'macos/AppIcon.iconset' },
  { width: 256, height: 256, filename: 'icon_256x256.png', folder: 'macos/AppIcon.iconset' },
  { width: 512, height: 512, filename: 'icon_256x256@2x.png', folder: 'macos/AppIcon.iconset' },
  { width: 512, height: 512, filename: 'icon_512x512.png', folder: 'macos/AppIcon.iconset' },
  { width: 1024, height: 1024, filename: 'icon_512x512@2x.png', folder: 'macos/AppIcon.iconset' },
]

// ICNS OSType codes mapped to pixel sizes.
//
// There is deliberately no `icp6`. It reads like the 64px slot and this encoder
// used to write a 64px PNG into it, but Apple's own `iconutil` treats `icp6` as
// 48×48 and resampled that image down to 48 when it opened the file. The 64px
// render is already carried by `ic12` (32×32@2x), which is where Apple's tools
// put it; `iconutil` emits no 64px @1x entry at all.
export const ICNS_ENTRIES: { osType: string; size: number }[] = [
  { osType: 'icp4', size: 16 },
  { osType: 'icp5', size: 32 },
  { osType: 'ic07', size: 128 },
  { osType: 'ic08', size: 256 },
  { osType: 'ic09', size: 512 },
  { osType: 'ic10', size: 1024 },
  { osType: 'ic11', size: 32 },   // 16x16@2x
  { osType: 'ic12', size: 64 },   // 32x32@2x
  { osType: 'ic13', size: 256 },  // 128x128@2x
  { osType: 'ic14', size: 512 },  // 256x256@2x
]

// iOS – a single-size asset catalog set (Xcode 15+ derives every other size),
// with the light, dark and tinted appearances iOS 18 introduced. The folder IS
// an appiconset, with its Contents.json beside the images, so it drops into an
// asset catalog as-is.
export const IOS_APPICONSET = 'ios/AppIcon.appiconset'
export const IOS_SIZES: PlatformSizeEntry[] = [
  { width: 1024, height: 1024, filename: 'AppIcon-1024x1024.png', folder: IOS_APPICONSET },
]
export const IOS_DARK_SUFFIX = '-Dark'
export const IOS_TINTED_SUFFIX = '-Tinted'

// Android – adaptive layer at xxxhdpi + mipmap legacy fallbacks
export const ANDROID_ADAPTIVE_SIZE = 432 // xxxhdpi adaptive layer
export const ANDROID_MIPMAP_SIZES: PlatformSizeEntry[] = [
  { width: 48, height: 48, filename: 'ic_launcher.png', folder: 'android/mipmap-mdpi' },
  { width: 72, height: 72, filename: 'ic_launcher.png', folder: 'android/mipmap-hdpi' },
  { width: 96, height: 96, filename: 'ic_launcher.png', folder: 'android/mipmap-xhdpi' },
  { width: 144, height: 144, filename: 'ic_launcher.png', folder: 'android/mipmap-xxhdpi' },
  { width: 192, height: 192, filename: 'ic_launcher.png', folder: 'android/mipmap-xxxhdpi' },
]
export const ANDROID_PLAY_STORE: PlatformSizeEntry = {
  width: 512, height: 512, filename: 'play-store-512.png', folder: 'android',
}

// Windows .ico – multi-resolution container.
//
// Microsoft's DPI table for desktop icons: notification area 16/20/24/32/40/48/64,
// taskbar 24/30/36/48/60/72/96, Start 32/40/48/64/80/96/256. Windows takes an
// exact match and otherwise scales the next frame up, and that scaler is what
// makes a "blurry Windows icon". 20, 40 and 96 fill the 125%, 250% and 400%
// steps the table used to skip; the remaining taskbar steps (30/36/60/72/80) each
// have a frame within a scale step above them.
export const WINDOWS_ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]

// Windows Store (MSIX) tile assets. Unlike the .ico (the exe/taskbar icon),
// these are the Store/Start tiles and app-list icons. They are TRANSPARENT PNGs:
// the tile's plate color comes from the manifest's BackgroundColor, not the
// image (contrast with iOS, which forbids alpha). Each logo ships at five MRT
// scale factors, and the 44×44 app-list icon additionally ships target-size
// variants (below).
//
// The graphic sits inside a safe area with transparent padding so it floats on
// the tile plate; the Windows Store platform's zoom multiplies it.
export const WINDOWS_STORE_SAFE_FRACTION = 0.72

/**
 * Target-size app-list icons: Microsoft's "Required" list. Each size ships three
 * times -- plain (Windows adds its own accent plate behind it), `_altform-unplated`
 * (no plate, drawn on the dark taskbar) and `_altform-lightunplated` (no plate,
 * light taskbar). Microsoft requires separate files for all three "even if the
 * icon is the same"; without them the shell scales a tile down and puts a plate
 * behind it, and without the exact size it scales the next one up.
 */
export const WINDOWS_STORE_TARGET_SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256]

export type WindowsStoreTarget = 'plated' | 'unplated' | 'lightunplated'

/**
 * A Windows Store asset. `target` is set on the target-size app-list icons and
 * says which of the three variants it is; tiles carry none.
 */
export interface WindowsStoreAsset extends PlatformSizeEntry {
  target?: WindowsStoreTarget
}

const WINDOWS_STORE_SCALES = [100, 125, 150, 200, 400]
// MRT rounds a scaled asset dimension UP to the next whole pixel.
const scaleUp = (base: number, scale: number) => Math.ceil((base * scale) / 100)

function buildWindowsStoreAssets(): WindowsStoreAsset[] {
  const folder = 'windows-store/Assets'
  const assets: WindowsStoreAsset[] = []

  // Square logos + the Store listing logo, each at every scale factor.
  const squares: { name: string; base: number }[] = [
    { name: 'Square44x44Logo', base: 44 },   // app list / taskbar / Start (small)
    { name: 'Square71x71Logo', base: 71 },   // small tile
    { name: 'Square150x150Logo', base: 150 }, // medium tile
    { name: 'Square310x310Logo', base: 310 }, // large tile
    { name: 'StoreLogo', base: 50 },          // Store listing + Properties>Logo
  ]
  for (const { name, base } of squares) {
    for (const scale of WINDOWS_STORE_SCALES) {
      const px = scaleUp(base, scale)
      assets.push({ width: px, height: px, filename: `${name}.scale-${scale}.png`, folder })
    }
  }

  // Wide tile (310×150), every scale factor.
  for (const scale of WINDOWS_STORE_SCALES) {
    assets.push({
      width: scaleUp(310, scale),
      height: scaleUp(150, scale),
      filename: `Wide310x150Logo.scale-${scale}.png`,
      folder,
    })
  }

  // Target-size app-list icons, three variants each. The unplated pair is drawn
  // from the UNPLATED sources (full-color, reads on a bare taskbar) rather than
  // the tile source, so a mono tile can pair with a full-color taskbar icon.
  const suffix: Record<WindowsStoreTarget, string> = {
    plated: '',
    unplated: '_altform-unplated',
    lightunplated: '_altform-lightunplated',
  }
  for (const size of WINDOWS_STORE_TARGET_SIZES) {
    for (const target of Object.keys(suffix) as WindowsStoreTarget[]) {
      assets.push({
        width: size,
        height: size,
        filename: `Square44x44Logo.targetsize-${size}${suffix[target]}.png`,
        folder,
        target,
      })
    }
  }

  return assets
}

export const WINDOWS_STORE_ASSETS = buildWindowsStoreAssets()

// Linux – Freedesktop standard sizes. An SVG source is additionally passed
// through as `linux/icon.svg`, the `scalable/` icon Flathub prefers.
export const LINUX_SIZES: PlatformSizeEntry[] = [
  { width: 16, height: 16, filename: '16.png', folder: 'linux' },
  { width: 24, height: 24, filename: '24.png', folder: 'linux' },
  { width: 32, height: 32, filename: '32.png', folder: 'linux' },
  { width: 48, height: 48, filename: '48.png', folder: 'linux' },
  { width: 64, height: 64, filename: '64.png', folder: 'linux' },
  { width: 128, height: 128, filename: '128.png', folder: 'linux' },
  { width: 256, height: 256, filename: '256.png', folder: 'linux' },
  { width: 512, height: 512, filename: '512.png', folder: 'linux' },
]
export const LINUX_SVG_PATH = 'linux/icon.svg'

// PWA – regular + maskable
export const PWA_SIZES: PlatformSizeEntry[] = [
  { width: 192, height: 192, filename: 'icon-192.png', folder: 'pwa' },
  { width: 512, height: 512, filename: 'icon-512.png', folder: 'pwa' },
]
export const PWA_MASKABLE_SIZES: PlatformSizeEntry[] = [
  { width: 192, height: 192, filename: 'icon-maskable-192.png', folder: 'pwa' },
  { width: 512, height: 512, filename: 'icon-maskable-512.png', folder: 'pwa' },
]
/** The W3C safe zone is a circle of radius 40%, so the artwork fits the inner 80%. */
export const PWA_MASKABLE_SAFE_FRACTION = 0.8

// Apple Touch Icon
export const APPLE_TOUCH_ICON: PlatformSizeEntry = {
  width: 180, height: 180, filename: 'apple-touch-icon.png', folder: '',
}

// Favicon .ico sizes
export const FAVICON_ICO_SIZES = [16, 32]

// Tray Icon – cross-platform system tray / menu bar.
//
// Every OS gets a light set (the artwork as-is) and a dark set (a white
// silhouette with the artwork's alpha), because a dark taskbar or panel wants
// a knocked-out glyph and a light one wants the mark. macOS ignores the colour
// of a template image and tints the alpha itself, so its dark files are only
// there for apps that do not use template mode.
export const TRAY_MACOS_SIZES: PlatformSizeEntry[] = [
  { width: 22, height: 22, filename: 'trayTemplate.png', folder: 'tray/macos' },
  { width: 44, height: 44, filename: 'trayTemplate@2x.png', folder: 'tray/macos' },
]
export const TRAY_MACOS_DARK_SIZES: PlatformSizeEntry[] = [
  { width: 22, height: 22, filename: 'trayTemplate-dark.png', folder: 'tray/macos' },
  { width: 44, height: 44, filename: 'trayTemplate-dark@2x.png', folder: 'tray/macos' },
]
// Microsoft's notification-area sizes at 100/125/150/200/250/300/400%. Shipped
// both inside `tray.ico` and as one PNG per size, because a Tauri or Electron
// app sets its tray icon from a single image and wants the DPI-matched one --
// handing Windows a 44px image and letting it scale to 16 is how a tray icon
// ends up blurry.
export const TRAY_WINDOWS_ICO_SIZES = [16, 20, 24, 32, 40, 48, 64]
export const TRAY_WINDOWS_SIZES: PlatformSizeEntry[] = TRAY_WINDOWS_ICO_SIZES.map((size) => ({
  width: size, height: size, filename: `tray-${size}.png`, folder: 'tray/windows',
}))
export const TRAY_LINUX_SIZES: PlatformSizeEntry[] = [
  { width: 16, height: 16, filename: 'tray-16.png', folder: 'tray/linux' },
  { width: 22, height: 22, filename: 'tray-22.png', folder: 'tray/linux' },
  { width: 24, height: 24, filename: 'tray-24.png', folder: 'tray/linux' },
  { width: 32, height: 32, filename: 'tray-32.png', folder: 'tray/linux' },
  { width: 48, height: 48, filename: 'tray-48.png', folder: 'tray/linux' },
]
