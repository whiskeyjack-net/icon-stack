/**
 * Browser backend: real DOM canvases, with pica for high-quality downscaling.
 *
 * This is the path the Icon Stack web app has always taken; the logic here is
 * lifted from its old `lib/resize.ts` unchanged, including the pica fallback.
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

export const browserCanvasBackend: CanvasBackend = {
  createCanvas(width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas as unknown as IconCanvas
  },

  loadImage(src) {
    const url =
      typeof src === 'string'
        ? src
        : URL.createObjectURL(new Blob([src as BlobPart], { type: 'image/png' }))
    return new Promise<IconDrawable>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img as unknown as IconDrawable)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
  },

  /**
   * Pica's manual-math (Lanczos3) path needs `getImageData` to return real
   * pixels. Firefox's fingerprinting protection randomizes those bytes, so the
   * probe fails and every resize throws ERR_GET_IMAGE_DATA. Fall back rather
   * than make the user disable a privacy setting to generate icons.
   */
  async resize(source, targetWidth, targetHeight) {
    const src = source as unknown as HTMLCanvasElement
    const target = document.createElement('canvas')
    target.width = targetWidth
    target.height = targetHeight
    try {
      await pica.resize(src, target, { quality: 3 })
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
