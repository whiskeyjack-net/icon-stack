/**
 * Turns a dropped or picked browser File into the core's SourceImage.
 *
 * The core is host-agnostic on purpose: it wants a data URL, dimensions, and
 * (for SVG) the raw markup. Everything File-shaped stays here.
 */
import type { SourceImage } from '@whiskeyjack-net/icon-stack-core'

export interface ProcessResult {
  source: SourceImage
  warning: string | null
}

export async function processFile(file: File): Promise<ProcessResult> {
  const isPng = file.type === 'image/png'
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')

  if (!isPng && !isSvg) {
    throw new Error('Upload a PNG or SVG file.')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not decode that image.'))
    img.src = dataUrl
  })

  const width = img.naturalWidth
  const height = img.naturalHeight

  let warning: string | null = null
  if (width !== height) {
    warning = `Source is ${width}x${height}. Square sources work best.`
  } else if (isPng && width < 1024) {
    warning = `Source is ${width}x${height}. 1024x1024 is recommended.`
  }

  return {
    source: {
      type: isSvg ? 'svg' : 'png',
      dataUrl,
      width,
      height,
      fileName: file.name,
      // The core does the favicon SVG passthrough from markup rather than a
      // browser File, so read it while we still have one.
      svgText: isSvg ? await file.text() : undefined,
    },
    warning,
  }
}
