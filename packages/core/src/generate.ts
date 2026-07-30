import type { PlatformConfigs, AppleConfig, TrayIconConfig, SourceImage, SourceChoice, BackgroundFill, ImageFit } from './types'
import {
  MACOS_SIZES,
  ICNS_ENTRIES,
  IOS_SIZES,
  ANDROID_ADAPTIVE_SIZE,
  ANDROID_MIPMAP_SIZES,
  ANDROID_PLAY_STORE,
  WINDOWS_ICO_SIZES,
  WINDOWS_STORE_ASSETS,
  WINDOWS_STORE_SAFE_FRACTION,
  LINUX_SIZES,
  PWA_SIZES,
  PWA_MASKABLE_SIZES,
  APPLE_TOUCH_ICON,
  FAVICON_ICO_SIZES,
  TRAY_MACOS_SIZES,
  TRAY_MACOS_DARK_SIZES,
  TRAY_WINDOWS_ICO_SIZES,
  TRAY_LINUX_SIZES,
} from './platform-configs'
import { loadImage, imageToCanvas, imageToSquareCanvas, resizeCanvas, canvasToPng } from './resize'
import { drawWithBackground, drawWithBackgroundAndPadding, drawAdaptiveForeground, drawMaskableIcon, drawWithZoom, applyRoundedCorners, invertColors, fillBackground, centerLogoOnCanvas } from './canvas-utils'
import { resolveGradientColors } from './color-utils'
import { encodeIcns } from './icns-encoder'
import { encodeIco } from './ico-encoder'
import { buildZip } from './zip-builder'
import { createCanvas, context2d, type IconCanvas } from './canvas-backend'

interface ZipFile {
  path: string
  data: Uint8Array
}

export interface GenerateOptions {
  source: SourceImage
  alternate: SourceImage | null
  platforms: PlatformConfigs
  sourceFit: ImageFit
  alternateFit: ImageFit
  faviconFit: ImageFit
  trayFit: ImageFit
  onProgress: (percent: number) => void
}

/** Minimum rasterization size for SVG sources to preserve vector quality */
const SVG_RASTER_SIZE = 2048

/**
 * Loads a SourceImage into a canvas. SVGs are rasterized at high resolution
 * so downstream Lanczos downscaling stays crisp.
 */
async function loadSourceCanvas(source: SourceImage, fit: ImageFit = 'contain'): Promise<IconCanvas> {
  if (source.type === 'svg') {
    // Ask the backend to rasterize the vector AT the working size. Decoding at
    // the SVG's intrinsic size and upscaling afterwards throws away the very
    // resolution independence that makes an SVG source worth using.
    const img = await loadImage(source.dataUrl, {
      width: SVG_RASTER_SIZE,
      height: SVG_RASTER_SIZE,
    })
    const size = Math.max(SVG_RASTER_SIZE, img.width, img.height)
    return imageToSquareCanvas(img, size, fit)
  }
  const img = await loadImage(source.dataUrl)
  const size = Math.max(img.width, img.height)
  return imageToSquareCanvas(img, size, fit)
}

/**
 * Generates a resized PNG at the given size from the source canvas.
 */
async function generatePng(sourceCanvas: IconCanvas, size: number): Promise<{ data: Uint8Array }> {
  const resized = await resizeCanvas(sourceCanvas, size, size)
  return { data: await canvasToPng(resized) }
}

/**
 * Generates a resized PNG with a background fill (solid or gradient).
 */
async function generatePngWithBg(
  sourceCanvas: IconCanvas,
  size: number,
  bgFill: BackgroundFill,
): Promise<{ data: Uint8Array }> {
  const resized = await resizeCanvas(sourceCanvas, size, size)
  const withBg = drawWithBackground(resized, bgFill)
  return { data: await canvasToPng(withBg) }
}

/** Converts a hex color (#RRGGBB) to Apple's sRGB string format "srgb:R,G,B,1.00000" */
function hexToSrgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return `srgb:${r.toFixed(5)},${g.toFixed(5)},${b.toFixed(5)},1.00000`
}

/**
 * Resolves a source canvas based on the source choice.
 * Returns the alternate canvas if the choice is 'alternate' and it exists,
 * otherwise falls back to the main canvas.
 */
function resolveCanvas(
  choice: SourceChoice,
  main: IconCanvas,
  alt: IconCanvas | null,
): IconCanvas {
  return (choice === 'alternate' && alt) ? alt : main
}

/** Builds the icon.json content for an Apple .icon bundle */
function buildAppleIconJson(
  config: AppleConfig,
  fgName: string,
  darkFgName?: string,
  lightFgName?: string,
  monoName?: string,
): string {
  const shadow = { kind: config.shadow.kind, opacity: config.shadow.opacity }
  const translucency = { enabled: config.translucency.enabled, value: config.translucency.value }
  const hasDark = !!darkFgName
  const hasLight = !!lightFgName
  const hasMono = !!monoName

  // --- fill-specializations: always light + dark ---
  const buildFillValue = (fill: BackgroundFill): Record<string, unknown> => {
    if (fill.type === 'solid') {
      return { solid: hexToSrgb(fill.color) }
    }
    const { top, bottom } = resolveGradientColors(fill.gradient)
    return {
      'linear-gradient': [hexToSrgb(top), hexToSrgb(bottom)],
      orientation: {
        start: { x: 0.5, y: 0 },
        stop: { x: 0.5, y: 0.7 },
      },
    }
  }

  const fillSpecializations: Array<Record<string, unknown>> = [
    { value: buildFillValue(config.bgFill) },
    { appearance: 'dark', value: buildFillValue(config.bgFillDark) },
  ]

  // --- groups (order: mono → dark → main foreground) ---
  const groups: Array<Record<string, unknown>> = []

  // Dark foreground group (visible only in dark mode, when separate dark variant provided)
  if (hasDark) {
    groups.push({
      layers: [{
        glass: false,
        'image-name': darkFgName,
        name: darkFgName!.replace('.png', ''),
        'opacity-specializations': [
          { value: 0 },
          { appearance: 'dark', value: 1 },
        ],
      }],
      shadow,
      translucency,
    })
  }

  // Mono group (visible in tinted mode; also visible in light when no light variant)
  if (hasMono) {
    const monoOpacity: Array<Record<string, unknown>> = [
      { appearance: 'dark', value: 0 },
    ]
    if (hasLight) {
      monoOpacity.push({ value: 0 })
      monoOpacity.push({ appearance: 'tinted', value: 1 })
    }

    groups.push({
      layers: [{
        glass: false,
        'image-name': monoName,
        name: monoName!.replace('.png', ''),
        'opacity-specializations': monoOpacity,
      }],
      name: 'Group',
      shadow,
      translucency,
    })
  }

  // Light foreground group (visible only in light mode, when provided)
  if (hasLight) {
    groups.push({
      layers: [{
        glass: false,
        'image-name': lightFgName,
        name: lightFgName!.replace('.png', ''),
        'opacity-specializations': [
          { value: 1 },
          { appearance: 'dark', value: 0 },
          { appearance: 'tinted', value: 0 },
        ],
      }],
      name: 'Group',
      shadow,
      translucency,
    })
  }

  // Main foreground group
  const fgOpacitySpecs: Array<Record<string, unknown>> = []
  if (hasLight) {
    fgOpacitySpecs.push({ value: 0 })
    if (!hasDark) fgOpacitySpecs.push({ appearance: 'dark', value: 1 })
  }
  if (hasDark) fgOpacitySpecs.push({ appearance: 'dark', value: 0 })
  if (hasMono) fgOpacitySpecs.push({ appearance: 'tinted', value: 0 })

  const fgLayer: Record<string, unknown> = {
    glass: config.glass,
    'image-name': fgName,
    name: fgName.replace('.png', ''),
  }
  if (fgOpacitySpecs.length > 0) {
    fgLayer['opacity-specializations'] = fgOpacitySpecs
  }

  groups.push({ layers: [fgLayer], shadow, translucency })

  return JSON.stringify({
    'fill-specializations': fillSpecializations,
    groups,
    'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
  }, null, 2)
}

/**
 * Main generation pipeline.
 * Takes a source image + optional alternate + platform configs, produces a ZIP blob.
 */
export async function generateIcons(options: GenerateOptions): Promise<Uint8Array> {
  const { source, alternate, platforms, sourceFit, alternateFit, faviconFit, trayFit, onProgress } = options
  const files: ZipFile[] = []

  // Load source into a square canvas (SVGs rasterized at high resolution)
  const sourceCanvas = await loadSourceCanvas(source, sourceFit)

  // Load alternate canvas if provided
  const alternateCanvas = alternate
    ? await loadSourceCanvas(alternate, alternateFit)
    : null

  // Count total steps for progress
  let totalSteps = 0
  if (platforms.apple.enabled) totalSteps += 5 // foreground + light + dark + mono + icon.json
  if (platforms.macos.enabled) totalSteps += MACOS_SIZES.length + ICNS_ENTRIES.length + 1
  if (platforms.ios.enabled) totalSteps += IOS_SIZES.length
  if (platforms.android.enabled) totalSteps += ANDROID_MIPMAP_SIZES.length + 3
  if (platforms.windows.enabled) totalSteps += WINDOWS_ICO_SIZES.length + 1
  if (platforms.windowsStore.enabled) totalSteps += WINDOWS_STORE_ASSETS.length
  if (platforms.linux.enabled) totalSteps += LINUX_SIZES.length
  if (platforms.pwa.enabled) totalSteps += PWA_SIZES.length + PWA_MASKABLE_SIZES.length
  if (platforms.favicon.enabled) totalSteps += FAVICON_ICO_SIZES.length + 1
  if (platforms.appleTouchIcon.enabled) totalSteps += 1
  if (platforms.trayIcon.enabled) totalSteps += TRAY_MACOS_SIZES.length + TRAY_MACOS_DARK_SIZES.length + TRAY_WINDOWS_ICO_SIZES.length + 1 + TRAY_LINUX_SIZES.length * 2

  let completedSteps = 0
  const step = () => {
    completedSteps++
    onProgress(Math.round((completedSteps / totalSteps) * 100))
  }

  // --- Apple (.icon) ---
  if (platforms.apple.enabled) {
    const appleConfig = platforms.apple
    const appleZoom = appleConfig.zoom
    const appleSource = appleZoom !== 100
      ? drawWithZoom(sourceCanvas, sourceCanvas.width, appleZoom)
      : sourceCanvas

    // Generate foreground PNG at 1024×1024 (main source, serves as fallback)
    const { data: fgData } = await generatePng(appleSource, 1024)
    const fgName = 'foreground.png'
    files.push({ path: `apple/AppIcon.icon/Assets/${fgName}`, data: fgData })
    step()

    // Light variant foreground (only when using alternate source for light)
    let lightFgName: string | undefined
    if (appleConfig.lightSourceChoice === 'alternate' && alternateCanvas) {
      const lightCanvas = appleZoom !== 100
        ? drawWithZoom(alternateCanvas, alternateCanvas.width, appleZoom)
        : alternateCanvas
      const { data: lightData } = await generatePng(lightCanvas, 1024)
      lightFgName = 'foreground-light.png'
      files.push({ path: `apple/AppIcon.icon/Assets/${lightFgName}`, data: lightData })
      step()
    }

    // Dark variant foreground (only when using alternate source for dark)
    let darkFgName: string | undefined
    if (appleConfig.darkSourceChoice === 'alternate' && alternateCanvas) {
      const darkCanvas = appleZoom !== 100
        ? drawWithZoom(alternateCanvas, alternateCanvas.width, appleZoom)
        : alternateCanvas
      const { data: darkData } = await generatePng(darkCanvas, 1024)
      darkFgName = 'foreground-dark.png'
      files.push({ path: `apple/AppIcon.icon/Assets/${darkFgName}`, data: darkData })
      step()
    }

    // Mono layer (only when using alternate source for mono)
    let monoName: string | undefined
    if (appleConfig.monoSourceChoice === 'alternate' && alternateCanvas) {
      const { data: monoData } = await generatePng(alternateCanvas, 1024)
      monoName = 'mono.png'
      files.push({ path: `apple/AppIcon.icon/Assets/${monoName}`, data: monoData })
      step()
    }

    // Build icon.json
    const iconJsonStr = buildAppleIconJson(appleConfig, fgName, darkFgName, lightFgName, monoName)
    const encoder = new TextEncoder()
    files.push({ path: 'apple/AppIcon.icon/icon.json', data: encoder.encode(iconJsonStr) })
    step()
  }

  // --- macOS ---
  if (platforms.macos.enabled) {
    const macosConfig = platforms.macos
    const macosZoom = macosConfig.zoom

    // Resolve sources for default and dark variants
    const macosDefaultCanvas = resolveCanvas(macosConfig.sourceChoice, sourceCanvas, alternateCanvas)
    const macosDarkCanvas = resolveCanvas(macosConfig.darkSourceChoice, sourceCanvas, alternateCanvas)

    const macosSource = macosZoom !== 100
      ? drawWithZoom(macosDefaultCanvas, macosDefaultCanvas.width, macosZoom)
      : macosDefaultCanvas

    const macosUseBg = !macosConfig.bgTransparent

    // Helper: generate a macOS PNG with or without background
    const generateMacosPng = async (src: IconCanvas, size: number, bgFill?: BackgroundFill) => {
      // Legacy macOS is the one OS-shaped platform that rounds its OWN artwork:
      // a `.icns` is not masked by the system, so the image IS the icon's
      // silhouette. Every other dark-variant platform leaves the shape to the OS,
      // which is why the corner fields sit on MacosConfig rather than on
      // DarkVariantConfig.
      //
      // Rounding needs a plate to clip, so it only applies with a background --
      // the same condition the settings UI gates the sliders on.
      let canvas = await resizeCanvas(src, size, size)
      if (bgFill) canvas = drawWithBackground(canvas, bgFill)
      if (bgFill && macosConfig.cornerRadius > 0) {
        canvas = applyRoundedCorners(canvas, macosConfig.cornerRadius, macosConfig.cornerSmoothing)
      }
      return { data: await canvasToPng(canvas) }
    }

    // Generate iconset PNGs (light)
    const icnsPngs = new Map<number, Uint8Array>()

    for (const entry of MACOS_SIZES) {
      const { data } = await generateMacosPng(macosSource, entry.width, macosUseBg ? macosConfig.bgFill : undefined)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      icnsPngs.set(entry.width, data)
      step()
    }

    // Build ICNS (light)
    const icnsEntries = []
    for (const entry of ICNS_ENTRIES) {
      let pngData = icnsPngs.get(entry.size)
      if (!pngData) {
        const { data } = await generateMacosPng(macosSource, entry.size, macosUseBg ? macosConfig.bgFill : undefined)
        pngData = data
      }
      icnsEntries.push({ osType: entry.osType, pngData })
      step()
    }
    const icnsData = encodeIcns(icnsEntries)
    files.push({ path: 'macos/AppIcon.icns', data: icnsData })
    step()

    // Dark variant (always exported)
    const darkSourceCanvas = macosZoom !== 100
      ? drawWithZoom(macosDarkCanvas, macosDarkCanvas.width, macosZoom)
      : macosDarkCanvas

    const darkIcnsPngs = new Map<number, Uint8Array>()

    for (const entry of MACOS_SIZES) {
      const darkFolder = entry.folder.replace('AppIcon.iconset', 'AppIcon-Dark.iconset')
      const { data } = await generateMacosPng(darkSourceCanvas, entry.width, macosUseBg ? macosConfig.bgFillDark : undefined)
      files.push({ path: `${darkFolder}/${entry.filename}`, data })
      darkIcnsPngs.set(entry.width, data)
    }

    const darkIcnsEntries = []
    for (const entry of ICNS_ENTRIES) {
      let pngData = darkIcnsPngs.get(entry.size)
      if (!pngData) {
        const { data } = await generateMacosPng(darkSourceCanvas, entry.size, macosUseBg ? macosConfig.bgFillDark : undefined)
        pngData = data
      }
      darkIcnsEntries.push({ osType: entry.osType, pngData })
    }
    const darkIcnsData = encodeIcns(darkIcnsEntries)
    files.push({ path: 'macos/AppIcon-Dark.icns', data: darkIcnsData })
  }

  // --- iOS ---
  if (platforms.ios.enabled) {
    const iosConfig = platforms.ios

    // Resolve sources for default and dark variants
    const iosDefaultCanvas = resolveCanvas(iosConfig.sourceChoice, sourceCanvas, alternateCanvas)
    const iosDarkCanvas = resolveCanvas(iosConfig.darkSourceChoice, sourceCanvas, alternateCanvas)

    const iosZoom = iosConfig.zoom
    const iosSource = iosZoom !== 100
      ? drawWithZoom(iosDefaultCanvas, iosDefaultCanvas.width, iosZoom)
      : iosDefaultCanvas

    for (const entry of IOS_SIZES) {
      // iOS requires opaque icons – add bg
      const { data } = await generatePngWithBg(iosSource, entry.width, iosConfig.bgFill)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      step()
    }

    // Dark variant (always exported)
    const iosDarkSource = iosZoom !== 100
      ? drawWithZoom(iosDarkCanvas, iosDarkCanvas.width, iosZoom)
      : iosDarkCanvas

    for (const entry of IOS_SIZES) {
      const darkFilename = entry.filename.replace('.png', '-Dark.png')
      const { data } = await generatePngWithBg(iosDarkSource, entry.width, iosConfig.bgFillDark)
      files.push({ path: `${entry.folder}/${darkFilename}`, data })
    }
  }

  // --- Android ---
  if (platforms.android.enabled) {
    const config = platforms.android
    const androidZoom = config.zoom

    // Resolve source for default variant
    const androidDefaultCanvas = resolveCanvas(config.sourceChoice, sourceCanvas, alternateCanvas)

    // Foreground layer (432×432 with safe zone, adjusted by zoom)
    const fgCanvas = drawAdaptiveForeground(androidDefaultCanvas, ANDROID_ADAPTIVE_SIZE, androidZoom)
    const fgData = await canvasToPng(fgCanvas)
    files.push({ path: 'android/ic_launcher_foreground.png', data: fgData })
    step()

    // Background layer (solid or gradient)
    const bgCanvas = createCanvas(ANDROID_ADAPTIVE_SIZE, ANDROID_ADAPTIVE_SIZE)
    const bgCtx = context2d(bgCanvas)
    fillBackground(bgCtx, ANDROID_ADAPTIVE_SIZE, ANDROID_ADAPTIVE_SIZE, config.bgFill)
    const bgData = await canvasToPng(bgCanvas)
    files.push({ path: 'android/ic_launcher_background.png', data: bgData })
    step()

    // Monochrome layer (if enabled)
    if (config.useMonochrome) {
      const monoCanvas = resolveCanvas(config.monoSourceChoice, sourceCanvas, alternateCanvas)
      // A canvas is already drawable, so the old dataURL round-trip
      // (toDataURL -> loadImage) was pure overhead.
      const monoSized = imageToCanvas(monoCanvas, ANDROID_ADAPTIVE_SIZE, ANDROID_ADAPTIVE_SIZE)
      const monoData = await canvasToPng(monoSized)
      files.push({ path: 'android/ic_launcher_monochrome.png', data: monoData })
    }

    // Mipmap legacy PNGs (composited: bg + fg, with zoom-adjusted padding)
    const mipmapPadding = (18 / 108) * (100 / androidZoom)
    for (const entry of ANDROID_MIPMAP_SIZES) {
      const composited = drawWithBackgroundAndPadding(
        androidDefaultCanvas,
        entry.width,
        entry.height,
        config.bgFill,
        mipmapPadding,
      )
      const { data } = await generatePng(composited, entry.width)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      step()
    }

    // Play Store 512
    const { data: playData } = await generatePngWithBg(androidDefaultCanvas, ANDROID_PLAY_STORE.width, config.bgFill)
    files.push({ path: `${ANDROID_PLAY_STORE.folder}/${ANDROID_PLAY_STORE.filename}`, data: playData })
    step()
  }

  // --- Windows ---
  if (platforms.windows.enabled) {
    const winConfig = platforms.windows
    const winDefaultCanvas = resolveCanvas(winConfig.sourceChoice, sourceCanvas, alternateCanvas)
    const winSource = winConfig.zoom !== 100
      ? drawWithZoom(winDefaultCanvas, winDefaultCanvas.width, winConfig.zoom)
      : winDefaultCanvas

    const icoEntries: { size: number; pngData: Uint8Array }[] = []

    for (const size of WINDOWS_ICO_SIZES) {
      let resized = await resizeCanvas(winSource, size, size)
      if (!winConfig.bgTransparent) {
        resized = drawWithBackground(resized, winConfig.bgFill)
      }
      const rounded = applyRoundedCorners(resized, winConfig.cornerRadius, winConfig.cornerSmoothing)
      const data = await canvasToPng(rounded)
      icoEntries.push({ size, pngData: data })
      step()
    }

    const icoData = encodeIco(icoEntries)
    files.push({ path: 'windows/app.ico', data: icoData })
    step()
  }

  // --- Windows Store (MSIX tiles) ---
  if (platforms.windowsStore.enabled) {
    const storeConfig = platforms.windowsStore
    // The user picks which source drives the plated tiles vs the unplated
    // (taskbar / Alt+Tab) icons -- e.g. a mono logo for the tiles (on the
    // manifest BackgroundColor plate) and a full-color logo for the taskbar
    // (reads on light AND dark). resolveCanvas falls back to main if the chosen
    // source is the (absent) alternate.
    const tileSource = resolveCanvas(storeConfig.sourceChoice, sourceCanvas, alternateCanvas)
    const unplatedSource = resolveCanvas(storeConfig.unplatedSourceChoice, sourceCanvas, alternateCanvas)

    // Tiles and the unplated (taskbar) icons scale independently, so each has
    // its own zoom. Plated TILES float in a safe area (transparent padding) on
    // the manifest plate, so their logo occupies WINDOWS_STORE_SAFE_FRACTION of
    // the tile at 100%. The UNPLATED taskbar / Alt+Tab / task-view icons are the
    // direct equivalent of the regular Windows .ico, so they fill edge-to-edge
    // at 100% (no safe area) -- matching the Windows platform. The tile plate
    // color is the MSIX manifest's job, so tiles stay transparent regardless of
    // the platform background fill.
    const tileFraction = WINDOWS_STORE_SAFE_FRACTION * (storeConfig.zoom / 100)
    const unplatedFraction = storeConfig.unplatedZoom / 100

    for (const asset of WINDOWS_STORE_ASSETS) {
      const src = asset.unplated ? unplatedSource : tileSource
      const fraction = asset.unplated ? unplatedFraction : tileFraction
      const box = Math.max(1, Math.round(Math.min(asset.width, asset.height) * fraction))
      const logo = await resizeCanvas(src, box, box)
      let composed = centerLogoOnCanvas(logo, asset.width, asset.height)
      // Tiles stay transparent (manifest supplies the plate). Unplated icons are
      // transparent unless the user bakes a background in (for a "give the
      // taskbar icon a plate" look), in which case the baked plate can be
      // rounded. Tiles are never rounded -- they float square on the plate.
      if (asset.unplated && !storeConfig.unplatedTransparent) {
        composed = drawWithBackground(composed, storeConfig.unplatedBgFill)
        composed = applyRoundedCorners(composed, storeConfig.cornerRadius, storeConfig.cornerSmoothing)
      }
      const data = await canvasToPng(composed)
      files.push({ path: `${asset.folder}/${asset.filename}`, data })
      step()
    }
  }

  // --- Linux ---
  if (platforms.linux.enabled) {
    const linuxConfig = platforms.linux
    const linuxDefaultCanvas = resolveCanvas(linuxConfig.sourceChoice, sourceCanvas, alternateCanvas)
    const linuxSource = linuxConfig.zoom !== 100
      ? drawWithZoom(linuxDefaultCanvas, linuxDefaultCanvas.width, linuxConfig.zoom)
      : linuxDefaultCanvas

    for (const entry of LINUX_SIZES) {
      let resized = await resizeCanvas(linuxSource, entry.width, entry.width)
      if (!linuxConfig.bgTransparent) {
        resized = drawWithBackground(resized, linuxConfig.bgFill)
      }
      const rounded = applyRoundedCorners(resized, linuxConfig.cornerRadius, linuxConfig.cornerSmoothing)
      const data = await canvasToPng(rounded)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      step()
    }
  }

  // --- PWA ---
  if (platforms.pwa.enabled) {
    const pwaConfig = platforms.pwa
    const pwaDefaultCanvas = resolveCanvas(pwaConfig.sourceChoice, sourceCanvas, alternateCanvas)
    const pwaZoom = pwaConfig.zoom
    const pwaSource = pwaZoom !== 100
      ? drawWithZoom(pwaDefaultCanvas, pwaDefaultCanvas.width, pwaZoom)
      : pwaDefaultCanvas

    // Regular icons (with optional background + corner radius)
    for (const entry of PWA_SIZES) {
      let resized = await resizeCanvas(pwaSource, entry.width, entry.width)
      if (!pwaConfig.bgTransparent) {
        resized = drawWithBackground(resized, pwaConfig.bgFill)
      }
      const rounded = applyRoundedCorners(resized, pwaConfig.cornerRadius, pwaConfig.cornerSmoothing)
      const data = await canvasToPng(rounded)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      step()
    }

    // Maskable icons (with safe zone padding + background – OS crops to mask shape)
    const pwaMaskableCanvas = resolveCanvas(pwaConfig.maskableSourceChoice, sourceCanvas, alternateCanvas)
    const pwaMaskableZoom = pwaConfig.maskableZoom
    const pwaMaskableSource = pwaMaskableZoom !== 100
      ? drawWithZoom(pwaMaskableCanvas, pwaMaskableCanvas.width, pwaMaskableZoom)
      : pwaMaskableCanvas
    for (const entry of PWA_MASKABLE_SIZES) {
      const maskable = drawMaskableIcon(pwaMaskableSource, entry.width, pwaConfig.maskableBgFill)
      const data = await canvasToPng(maskable)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      step()
    }
  }

  // --- Favicon ---
  if (platforms.favicon.enabled) {
    const faviconConfig = platforms.favicon

    // Use dedicated favicon source if provided, then source choice, then main
    let faviconCanvas: IconCanvas
    if (faviconConfig.faviconSource) {
      faviconCanvas = await loadSourceCanvas(faviconConfig.faviconSource, faviconFit)
    } else {
      faviconCanvas = resolveCanvas(faviconConfig.sourceChoice, sourceCanvas, alternateCanvas)
    }

    // Apply zoom
    if (faviconConfig.zoom !== 100) {
      faviconCanvas = drawWithZoom(faviconCanvas, faviconCanvas.width, faviconConfig.zoom)
    }

    const faviconEntries: { size: number; pngData: Uint8Array }[] = []

    for (const size of FAVICON_ICO_SIZES) {
      let resized = await resizeCanvas(faviconCanvas, size, size)
      if (!faviconConfig.bgTransparent) {
        resized = drawWithBackground(resized, faviconConfig.bgFill)
      }
      const rounded = applyRoundedCorners(resized, faviconConfig.cornerRadius, faviconConfig.cornerSmoothing)
      const data = await canvasToPng(rounded)
      faviconEntries.push({ size, pngData: data })
      step()
    }

    const icoData = encodeIco(faviconEntries)
    files.push({ path: 'favicon.ico', data: icoData })
    step()

    // SVG passthrough – prefer dedicated favicon source if it's SVG
    const svgMarkup = faviconConfig.faviconSource?.type === 'svg'
      ? faviconConfig.faviconSource.svgText
      : source.type === 'svg' ? source.svgText : undefined
    if (faviconConfig.includeSvg && svgMarkup) {
      files.push({ path: 'favicon.svg', data: new TextEncoder().encode(svgMarkup) })
    }
  }

  // --- Apple Touch Icon ---
  if (platforms.appleTouchIcon.enabled) {
    const atiConfig = platforms.appleTouchIcon
    const atiDefaultCanvas = resolveCanvas(atiConfig.sourceChoice, sourceCanvas, alternateCanvas)
    const atiSource = atiConfig.zoom !== 100
      ? drawWithZoom(atiDefaultCanvas, atiDefaultCanvas.width, atiConfig.zoom)
      : atiDefaultCanvas

    const { data } = await generatePngWithBg(
      atiSource,
      APPLE_TOUCH_ICON.width,
      atiConfig.bgFill,
    )
    const path = APPLE_TOUCH_ICON.folder
      ? `${APPLE_TOUCH_ICON.folder}/${APPLE_TOUCH_ICON.filename}`
      : APPLE_TOUCH_ICON.filename
    files.push({ path, data })
    step()
  }

  // --- Tray Icon ---
  if (platforms.trayIcon.enabled) {
    const trayConfig = platforms.trayIcon as TrayIconConfig

    // Use dedicated tray source if provided, otherwise fall back to main source
    let trayCanvas = sourceCanvas
    if (trayConfig.traySource) {
      trayCanvas = await loadSourceCanvas(trayConfig.traySource, trayFit)
    }

    // Apply zoom
    if (trayConfig.zoom !== 100) {
      trayCanvas = drawWithZoom(trayCanvas, trayCanvas.width, trayConfig.zoom)
    }

    // macOS: template PNGs (alpha-only, system tints for light/dark)
    for (const entry of TRAY_MACOS_SIZES) {
      const { data } = trayConfig.bgTransparent
        ? await generatePng(trayCanvas, entry.width)
        : await generatePngWithBg(trayCanvas, entry.width, trayConfig.bgFill)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      step()
    }

    // macOS: dark variants (color-inverted for light menu bars)
    const trayDarkCanvas = invertColors(trayCanvas)
    for (const entry of TRAY_MACOS_DARK_SIZES) {
      const { data } = trayConfig.bgTransparent
        ? await generatePng(trayDarkCanvas, entry.width)
        : await generatePngWithBg(trayDarkCanvas, entry.width, trayConfig.bgFill)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      step()
    }

    // Windows: tray.ico (multi-resolution container)
    const trayIcoEntries: { size: number; pngData: Uint8Array }[] = []
    for (const size of TRAY_WINDOWS_ICO_SIZES) {
      const resized = await resizeCanvas(trayCanvas, size, size)
      let final = resized
      if (!trayConfig.bgTransparent) {
        final = drawWithBackground(resized, trayConfig.bgFill)
      }
      const data = await canvasToPng(final)
      trayIcoEntries.push({ size, pngData: data })
      step()
    }
    const trayIcoData = encodeIco(trayIcoEntries)
    files.push({ path: 'tray/windows/tray.ico', data: trayIcoData })
    step()

    // Linux: individual PNGs
    for (const entry of TRAY_LINUX_SIZES) {
      const { data } = trayConfig.bgTransparent
        ? await generatePng(trayCanvas, entry.width)
        : await generatePngWithBg(trayCanvas, entry.width, trayConfig.bgFill)
      files.push({ path: `${entry.folder}/${entry.filename}`, data })
      step()
    }

    // Linux: dark variants (color-inverted)
    for (const entry of TRAY_LINUX_SIZES) {
      const darkFilename = entry.filename.replace('tray-', 'tray-dark-')
      const { data } = trayConfig.bgTransparent
        ? await generatePng(trayDarkCanvas, entry.width)
        : await generatePngWithBg(trayDarkCanvas, entry.width, trayConfig.bgFill)
      files.push({ path: `${entry.folder}/${darkFilename}`, data })
      step()
    }
  }

  onProgress(100)
  return buildZip(files)
}
