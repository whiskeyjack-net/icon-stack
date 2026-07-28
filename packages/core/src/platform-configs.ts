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

// ICNS OSType codes mapped to pixel sizes
export const ICNS_ENTRIES: { osType: string; size: number }[] = [
  { osType: 'icp4', size: 16 },
  { osType: 'icp5', size: 32 },
  { osType: 'icp6', size: 64 },
  { osType: 'ic07', size: 128 },
  { osType: 'ic08', size: 256 },
  { osType: 'ic09', size: 512 },
  { osType: 'ic10', size: 1024 },
  { osType: 'ic11', size: 32 },   // 16x16@2x
  { osType: 'ic12', size: 64 },   // 32x32@2x
  { osType: 'ic13', size: 256 },  // 128x128@2x
  { osType: 'ic14', size: 512 },  // 256x256@2x
]

// iOS – single 1024×1024 (Xcode 15+ handles all other sizes)
export const IOS_SIZES: PlatformSizeEntry[] = [
  { width: 1024, height: 1024, filename: 'AppIcon-1024x1024.png', folder: 'ios' },
]

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

// Windows .ico – multi-resolution container
export const WINDOWS_ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

// Windows Store (MSIX) tile assets. Unlike the .ico (the exe/taskbar icon),
// these are the Store/Start tiles and app-list icons. They are TRANSPARENT PNGs:
// the tile's plate color comes from the manifest's BackgroundColor, not the
// image (contrast with iOS, which forbids alpha). Each logo ships at five MRT
// scale factors, and the 44×44 app-list icon additionally ships unplated
// target-size variants (no colored plate – used on the taskbar, Alt+Tab, task
// view, and the Start tile's lower-right corner).
//
// The graphic sits inside a safe area (below) with transparent padding so it
// floats on the tile plate; the Windows Store platform's zoom multiplies it.
export const WINDOWS_STORE_SAFE_FRACTION = 0.72

// The unplated target-size (taskbar / Alt+Tab / task-view) icon sizes. These
// are drawn on a fixed source split from the tiles (main = tiles, alternate =
// unplated) so a full-color taskbar icon can pair with a mono tile.
export const WINDOWS_STORE_UNPLATED_SIZES = [16, 24, 32, 48, 256]

/** A Windows Store asset; `unplated` marks the no-plate taskbar variants. */
export interface WindowsStoreAsset extends PlatformSizeEntry {
  unplated?: boolean
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

  // Unplated target-size app-list icons (drawn with no colored plate behind
  // them – the fix for a plated/blank taskbar icon on Store builds). Sourced
  // from the ALTERNATE image (full-color, reads on light/dark taskbars) rather
  // than the tile source.
  for (const size of WINDOWS_STORE_UNPLATED_SIZES) {
    assets.push({
      width: size,
      height: size,
      filename: `Square44x44Logo.targetsize-${size}_altform-unplated.png`,
      folder,
      unplated: true,
    })
  }

  return assets
}

export const WINDOWS_STORE_ASSETS = buildWindowsStoreAssets()

// Linux – Freedesktop standard sizes
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

// PWA – regular + maskable
export const PWA_SIZES: PlatformSizeEntry[] = [
  { width: 192, height: 192, filename: 'icon-192.png', folder: 'pwa' },
  { width: 512, height: 512, filename: 'icon-512.png', folder: 'pwa' },
]
export const PWA_MASKABLE_SIZES: PlatformSizeEntry[] = [
  { width: 192, height: 192, filename: 'icon-maskable-192.png', folder: 'pwa' },
  { width: 512, height: 512, filename: 'icon-maskable-512.png', folder: 'pwa' },
]

// Apple Touch Icon
export const APPLE_TOUCH_ICON: PlatformSizeEntry = {
  width: 180, height: 180, filename: 'apple-touch-icon.png', folder: '',
}

// Favicon .ico sizes
export const FAVICON_ICO_SIZES = [16, 32]

// Tray Icon – cross-platform system tray / menu bar
export const TRAY_MACOS_SIZES: PlatformSizeEntry[] = [
  { width: 22, height: 22, filename: 'trayTemplate.png', folder: 'tray/macos' },
  { width: 44, height: 44, filename: 'trayTemplate@2x.png', folder: 'tray/macos' },
]
export const TRAY_MACOS_DARK_SIZES: PlatformSizeEntry[] = [
  { width: 22, height: 22, filename: 'trayTemplate-dark.png', folder: 'tray/macos' },
  { width: 44, height: 44, filename: 'trayTemplate-dark@2x.png', folder: 'tray/macos' },
]
export const TRAY_WINDOWS_ICO_SIZES = [16, 20, 24, 32, 48]
export const TRAY_LINUX_SIZES: PlatformSizeEntry[] = [
  { width: 16, height: 16, filename: 'tray-16.png', folder: 'tray/linux' },
  { width: 22, height: 22, filename: 'tray-22.png', folder: 'tray/linux' },
  { width: 24, height: 24, filename: 'tray-24.png', folder: 'tray/linux' },
  { width: 32, height: 32, filename: 'tray-32.png', folder: 'tray/linux' },
  { width: 48, height: 48, filename: 'tray-48.png', folder: 'tray/linux' },
]
