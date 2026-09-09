/**
 * Browser backend: real DOM canvases, with pica for high-quality downscaling.
 *
 * This is the path the Icon Stack web app has always taken; the fallback logic
 * is lifted from its old `lib/resize.ts` unchanged.
 */
import Pica from 'pica'
import type { CanvasBackend, IconCanvas, IconDrawable } from '../canvas-backend'

const pica = new Pica()

/**
 * Logged once per page load so a dev sees why pica isn't being used, without
 * spamming the console for every per-size resize call.
 */
let warnedAboutFallback = false

async function resizeFallback(
  source: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
): Promise<HTMLCanvasElement> {
  if (!warnedAboutFallback) {
    warnedAboutFallback = true
    console.warn(
      'Icon Stack: high-quality resize via pica is unavailable (canvas getImageData ' +
        'returns randomized data, usually Firefox fingerprinting protection). ' +
        'Falling back to native createImageBitmap resize.',
    )
  }
  const target = document.createElement('canvas')
  target.width = targetWidth
  target.height = targetHeight
  const ctx = target.getContext('2d')!
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: 'high',
      })
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close?.()
      return target
    } catch {
      // fall through to drawImage
    }
  }
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
  return target
}

/** Whether a source is SVG markup: a data URL says so, bytes are sniffed. */
function isSvgSource(src: string | Uint8Array): boolean {
  if (typeof src === 'string') return src.startsWith('data:image/svg+xml')
  const head = new TextDecoder().decode(src.subarray(0, 256)).trimStart()
  return head.startsWith('<svg') || head.startsWith('<?xml')
}

function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

export const browserCanvasBackend: CanvasBackend = {
  createCanvas(width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas as unknown as IconCanvas
  },

  /**
   * A raster decodes to the `<img>` itself; the browser handles PNG, JPEG and
   * WebP alike. An SVG asked for at a size is rasterized onto a canvas fitting
   * that box, aspect preserved -- the contract the Node backend honours through
   * resvg. Without it a vector's `naturalWidth` is whatever its root element
   * says (often 24, sometimes 0), and the caller would be reading the wrong
   * dimensions for its fit maths.
   */
  async loadImage(src, size) {
    const svg = isSvgSource(src)
    const url =
      typeof src === 'string'
        ? src
        : URL.createObjectURL(
            new Blob([src as BlobPart], { type: svg ? 'image/svg+xml' : 'image/png' }),
          )
    const img = await decode(url)
    if (!svg || !size) return img as unknown as IconDrawable

    const naturalW = img.naturalWidth || size.width
    const naturalH = img.naturalHeight || size.height
    const scale = Math.min(size.width / naturalW, size.height / naturalH)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(naturalW * scale))
    canvas.height = Math.max(1, Math.round(naturalH * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas as unknown as IconDrawable
  },

  /**
   * Pica's default filter, `mks2013` (Magic Kernel Sharp), applied at every
   * stage. The old `{ quality: 3 }` selected Lanczos3, which pica now treats as a
   * legacy preset: it resamples the intermediate stages with a Hamming window
   * and only the last with Lanczos, and does no sharpening. Measured on real
   * icons at 16-44px the default is 15-40% crisper by Laplacian variance and is
   * what pica's own README recommends.
   *
   * Pica's manual-math path needs `getImageData` to return real pixels.
   * Firefox's fingerprinting protection randomizes those bytes, so the probe
   * fails and every resize throws ERR_GET_IMAGE_DATA. Fall back rather than
   * make the user disable a privacy setting to generate icons.
   */
  async resize(source, targetWidth, targetHeight) {
    const src = source as unknown as HTMLCanvasElement
    const target = document.createElement('canvas')
    target.width = targetWidth
    target.height = targetHeight
    try {
      await pica.resize(src, target)
      return target as unknown as IconCanvas
    } catch (err) {
      if ((err as { code?: string } | null)?.code !== 'ERR_GET_IMAGE_DATA') throw err
      return (await resizeFallback(src, targetWidth, targetHeight)) as unknown as IconCanvas
    }
  },

  toPng(canvas) {
    return new Promise<Uint8Array>((resolve, reject) => {
      ;(canvas as unknown as HTMLCanvasElement).toBlob((blob) => {
        if (!blob) return reject(new Error('Failed to create PNG blob'))
        blob
          .arrayBuffer()
          .then((buf) => resolve(new Uint8Array(buf)))
          .catch(reject)
      }, 'image/png')
    })
  },
}
