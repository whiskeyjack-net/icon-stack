import { createCanvas, context2d, type IconCanvas, type IconContext2D } from './canvas-backend'
import type { BackgroundFill } from './types'
import { resolveGradientColors } from './color-utils'

/**
 * Superellipse exponent at 100% corner smoothing. n=2 is a plain circle; n>2
 * gives the "fuller", continuous (iOS-like) corner. 5 is roughly Apple's icon
 * squircle; smoothing scales the exponent between 2 (circular) and this.
 */
const SMOOTHING_MAX_EXPONENT = 5

/**
 * Traces a rounded-rectangle subpath (0,0)-(w,h) with corner radius `r` (px)
 * into the current path. `smoothing` (0-100) blends the corner shape from a
 * classic quadratic rounded rect (0) toward a superellipse "squircle" corner
 * (100). The caller owns beginPath / clip / fill; this closes the path it
 * traces.
 */
export function traceRoundedPath(
  ctx: IconContext2D,
  w: number,
  h: number,
  r: number,
  smoothing: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  if (radius <= 0) {
    ctx.rect(0, 0, w, h)
    return
  }

  if (smoothing <= 0) {
    ctx.moveTo(radius, 0)
    ctx.lineTo(w - radius, 0)
    ctx.quadraticCurveTo(w, 0, w, radius)
    ctx.lineTo(w, h - radius)
    ctx.quadraticCurveTo(w, h, w - radius, h)
    ctx.lineTo(radius, h)
    ctx.quadraticCurveTo(0, h, 0, h - radius)
    ctx.lineTo(0, radius)
    ctx.quadraticCurveTo(0, 0, radius, 0)
    ctx.closePath()
    return
  }

  // Squircle corners: each quadrant is a superellipse (|dx/r|^n + |dy/r|^n = 1),
  // sampled as line segments. Corner smoothing (0-100) maps to the exponent n;
  // higher n bulges the corner toward the square corner (continuous look)
  // instead of following a circular arc. `pow = 2/n` maps a sweep angle onto it.
  const n = 2 + (Math.min(smoothing, 100) / 100) * (SMOOTHING_MAX_EXPONENT - 2)
  const pow = 2 / n
  const steps = Math.max(12, Math.min(64, Math.round(radius / 2)))
  const sample = (i: number) => {
    const t = (i / steps) * (Math.PI / 2)
    return [Math.pow(Math.sin(t), pow), Math.pow(Math.cos(t), pow)] as const
  }

  ctx.moveTo(radius, 0)
  ctx.lineTo(w - radius, 0)
  for (let i = 0; i <= steps; i++) {
    const [s, c] = sample(i) // top-right: (w-r,0) -> (w,r)
    ctx.lineTo(w - radius + radius * s, radius - radius * c)
  }
  ctx.lineTo(w, h - radius)
  for (let i = 0; i <= steps; i++) {
    const [s, c] = sample(i) // bottom-right: (w,h-r) -> (w-r,h)
    ctx.lineTo(w - radius + radius * c, h - radius + radius * s)
  }
  ctx.lineTo(radius, h)
  for (let i = 0; i <= steps; i++) {
    const [s, c] = sample(i) // bottom-left: (r,h) -> (0,h-r)
    ctx.lineTo(radius - radius * s, h - radius + radius * c)
  }
  ctx.lineTo(0, radius)
  for (let i = 0; i <= steps; i++) {
    const [s, c] = sample(i) // top-left: (0,r) -> (r,0)
    ctx.lineTo(radius - radius * c, radius - radius * s)
  }
  ctx.closePath()
}

/**
 * Applies a rounded (or squircle) corner clip to a canvas and redraws the
 * content. Used for Windows/Linux/Favicon/PWA/Windows Store exports where the
 * user has chosen rounded corners.
 * cornerRadiusPercent: 0-50 (percentage of the canvas size); `smoothing` (0-100)
 * blends the corners from circular toward a superellipse squircle.
 */
export function applyRoundedCorners(
  source: IconCanvas,
  cornerRadiusPercent: number,
  smoothing = 0,
): IconCanvas {
  if (cornerRadiusPercent <= 0) return source

  const canvas = createCanvas(source.width, source.height)
  const ctx = context2d(canvas)

  const r = (cornerRadiusPercent / 100) * Math.min(canvas.width, canvas.height)

  ctx.beginPath()
  traceRoundedPath(ctx, canvas.width, canvas.height, r, smoothing)
  ctx.clip()

  ctx.drawImage(source, 0, 0)

  return canvas
}

/**
 * Draws the source image at the given zoom level.
 * zoom: 100 = fill canvas, <100 = add padding, >100 = extend beyond canvas.
 */
export function drawWithZoom(
  source: IconCanvas,
  targetSize: number,
  zoom: number,
): IconCanvas {
  const canvas = createCanvas(targetSize, targetSize)
  const ctx = context2d(canvas)

  const scale = zoom / 100
  const artworkSize = targetSize * scale
  const offset = (targetSize - artworkSize) / 2

  ctx.drawImage(source, offset, offset, artworkSize, artworkSize)

  return canvas
}

/**
 * Fills a canvas context with a BackgroundFill (solid or gradient).
 */
export function fillBackground(
  ctx: IconContext2D,
  width: number,
  height: number,
  fill: BackgroundFill,
): void {
  if (fill.type === 'solid') {
    ctx.fillStyle = fill.color
    ctx.fillRect(0, 0, width, height)
  } else {
    const { top, bottom } = resolveGradientColors(fill.gradient)
    const gradient = ctx.createLinearGradient(width / 2, 0, width / 2, height)
    gradient.addColorStop(0, top)
    gradient.addColorStop(1, bottom)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
}

/**
 * Fills a canvas with a background fill, then draws the source image
 * on top. Used for platforms that require opaque icons (iOS, Apple Touch Icon).
 */
export function drawWithBackground(
  source: IconCanvas,
  bgFill: BackgroundFill,
): IconCanvas {
  const canvas = createCanvas(source.width, source.height)
  const ctx = context2d(canvas)

  fillBackground(ctx, canvas.width, canvas.height, bgFill)
  ctx.drawImage(source, 0, 0)

  return canvas
}

/**
 * Draws the source image with padding (as a fraction of the canvas size).
 * The image is centered and scaled to fit within the padded area.
 */
export function drawWithPadding(
  source: IconCanvas,
  targetWidth: number,
  targetHeight: number,
  paddingFraction: number,
): IconCanvas {
  const canvas = createCanvas(targetWidth, targetHeight)
  const ctx = context2d(canvas)

  const padX = targetWidth * paddingFraction
  const padY = targetHeight * paddingFraction
  const innerW = targetWidth - padX * 2
  const innerH = targetHeight - padY * 2

  ctx.drawImage(source, padX, padY, innerW, innerH)

  return canvas
}

/**
 * Draws the source image onto a canvas with the given background fill
 * and padding. Combines background fill + padding in one pass.
 */
export function drawWithBackgroundAndPadding(
  source: IconCanvas,
  targetWidth: number,
  targetHeight: number,
  bgFill: BackgroundFill,
  paddingFraction: number,
): IconCanvas {
  const canvas = createCanvas(targetWidth, targetHeight)
  const ctx = context2d(canvas)

  fillBackground(ctx, canvas.width, canvas.height, bgFill)

  const padX = targetWidth * paddingFraction
  const padY = targetHeight * paddingFraction
  const innerW = targetWidth - padX * 2
  const innerH = targetHeight - padY * 2

  ctx.drawImage(source, padX, padY, innerW, innerH)

  return canvas
}

/**
 * Creates an Android adaptive icon foreground layer.
 * The source is placed within the 66dp safe zone (inner 61% of the 108dp canvas).
 * At the target pixel size, safe zone = size × (66/108).
 * zoom: 100 = standard safe zone, >100 = extend beyond safe zone.
 */
export function drawAdaptiveForeground(
  source: IconCanvas,
  targetSize: number,
  zoom: number = 100,
): IconCanvas {
  const canvas = createCanvas(targetSize, targetSize)
  const ctx = context2d(canvas)

  // Safe zone: 66/108 ≈ 61.1% of the canvas, scaled by zoom
  const safeZone = targetSize * (66 / 108) * (zoom / 100)
  const offset = (targetSize - safeZone) / 2

  ctx.drawImage(source, offset, offset, safeZone, safeZone)

  return canvas
}

/**
 * Centers an already-sized square logo on a transparent canvas of the given
 * dimensions, preserving the logo's aspect ratio. Used for Windows Store tiles,
 * where a square graphic floats on a (possibly wide) transparent plate whose
 * color the MSIX manifest supplies. If the logo is larger than the canvas
 * (zoom > safe area) it is clipped at the edges, matching zoom-in behavior.
 */
export function centerLogoOnCanvas(
  logo: IconCanvas,
  width: number,
  height: number,
): IconCanvas {
  const canvas = createCanvas(width, height)
  const ctx = context2d(canvas)

  const offsetX = Math.round((width - logo.width) / 2)
  const offsetY = Math.round((height - logo.height) / 2)
  ctx.drawImage(logo, offsetX, offsetY)

  return canvas
}

/**
 * Inverts RGB channels of a canvas while preserving alpha.
 * Used to generate dark tray icon variants from the light source.
 */
export function invertColors(source: IconCanvas): IconCanvas {
  const canvas = createCanvas(source.width, source.height)
  const ctx = context2d(canvas)

  ctx.drawImage(source, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]       // R
    data[i + 1] = 255 - data[i + 1] // G
    data[i + 2] = 255 - data[i + 2] // B
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Creates a PWA maskable icon with proper safe zone padding.
 * The safe zone is a circle with radius = 40% of icon width,
 * so critical content must fit within the inner 80% centered area.
 */
export function drawMaskableIcon(
  source: IconCanvas,
  targetSize: number,
  bgFill: BackgroundFill | null,
): IconCanvas {
  const canvas = createCanvas(targetSize, targetSize)
  const ctx = context2d(canvas)

  // Fill background (skip if transparent)
  if (bgFill) {
    fillBackground(ctx, targetSize, targetSize, bgFill)
  }

  // Draw source within the safe zone (inner 80%)
  const safeSize = targetSize * 0.8
  const offset = (targetSize - safeSize) / 2

  ctx.drawImage(source, offset, offset, safeSize, safeSize)

  return canvas
}
