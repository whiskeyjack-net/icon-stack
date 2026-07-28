/**
 * Source loading and resizing, delegated to the installed canvas backend.
 *
 * The browser's pica (Lanczos3) and Node's Skia are genuinely different
 * resamplers, so this is the one step where the two hosts can disagree. Keeping
 * it behind the backend confines that disagreement to a single named place --
 * everything else in this package composites identically on both.
 */
import {
  createCanvas,
  context2d,
  getCanvasBackend,
  type IconCanvas,
  type IconDrawable,
} from './canvas-backend'
import type { ImageFit } from './types'

/** Decode a source (data URL or bytes). SVG rasterizes at `size` when given. */
export function loadImage(
  src: string | Uint8Array,
  size?: { width: number; height: number },
): Promise<IconDrawable> {
  return getCanvasBackend().loadImage(src, size)
}

/** Draws an already-decoded image onto a canvas at the given size. */
export function imageToCanvas(img: IconDrawable, width: number, height: number): IconCanvas {
  const canvas = createCanvas(width, height)
  context2d(canvas).drawImage(img, 0, 0, width, height)
  return canvas
}

/**
 * Fits a potentially non-square image into a square canvas.
 * - `contain`: scales to fit entirely, transparent padding on the short sides
 * - `cover`: scales to fill, cropping the long dimension
 * Square sources are drawn straight at the target size.
 */
export function imageToSquareCanvas(img: IconDrawable, size: number, fit: ImageFit): IconCanvas {
  const canvas = createCanvas(size, size)
  const ctx = context2d(canvas)

  const imgW = img.width
  const imgH = img.height

  if (imgW === imgH) {
    ctx.drawImage(img, 0, 0, size, size)
    return canvas
  }

  const scale =
    fit === 'contain' ? Math.min(size / imgW, size / imgH) : Math.max(size / imgW, size / imgH)

  const drawW = imgW * scale
  const drawH = imgH * scale
  ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH)
  return canvas
}

/** High-quality downscale via the host's resampler. */
export function resizeCanvas(
  source: IconCanvas,
  targetWidth: number,
  targetHeight: number,
): Promise<IconCanvas> {
  return getCanvasBackend().resize(source, targetWidth, targetHeight)
}

/** PNG bytes for a canvas. */
export function canvasToPng(canvas: IconCanvas): Promise<Uint8Array> {
  return getCanvasBackend().toPng(canvas)
}
