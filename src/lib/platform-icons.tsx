import {
  AppleLogo,
  AndroidLogo,
  WindowsLogo,
  LinuxLogo,
  Globe,
  DeviceMobile,
  Browsers,
  Tray,
  Storefront,
  Desktop,
} from '@phosphor-icons/react'
import type { Platform } from '@whiskeyjack-net/icon-stack-core'

/**
 * One icon per platform, so a tab is identifiable at a glance rather than by
 * reading eleven similar labels. Both the tab rails and the platform grid draw
 * from this map, which keeps a platform looking the same wherever it appears.
 *
 * Several platforms share a vendor and would otherwise collide: the Store tile
 * set and the desktop Windows set are different jobs, as are the three Apple
 * targets, so each takes the icon that names its job rather than its vendor.
 */
export const PLATFORM_ICONS: Record<Platform, typeof AppleLogo> = {
  favicon: Browsers,
  pwa: Globe,
  windows: WindowsLogo,
  windowsStore: Storefront,
  linux: LinuxLogo,
  android: AndroidLogo,
  apple: AppleLogo,
  macos: Desktop,
  ios: DeviceMobile,
  appleTouchIcon: AppleLogo,
  trayIcon: Tray,
}
