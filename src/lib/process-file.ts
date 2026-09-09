/**
 * Turns a dropped or picked browser File into the core's SourceImage.
 *
 * The core is host-agnostic on purpose: it wants a data URL, dimensions, and
 * (for SVG) the raw markup. Everything File-shaped stays here.
 *
 * Nothing here is display text. Warnings and failures come back as translation
 * keys with their parameters, and the component that shows them translates --
 * this module has no `t`, and a sentence assembled here would ship in English
 * to every locale.
 */
import type { SourceImage } from '@whiskeyjack-net/icon-stack-core'

/** The rasters a browser decodes natively; the core treats them all as `png`. */
const RASTER_TYPES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
}
const SVG_TYPE = 'image/svg+xml'

const EXTENSION_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': SVG_TYPE,
}

/** The `accept` value for every source file input, so the three agree. */
export const SOURCE_ACCEPT = [...Object.keys(RASTER_TYPES), SVG_TYPE, ...Object.keys(EXTENSION_TYPES)].join(',')

/** A message for the user: a translation key plus its interpolation values. */
export interface SourceNotice {
  key: string
  params?: Record<string, string | number>
}

/** A rejected file. `key` names the translation the UI shows beside the slot. */
export class SourceFileError extends Error {
  constructor(readonly key: string) {
    super(key)
    this.name = 'SourceFileError'
  }
}

export interface ProcessResult {
  source: SourceImage
  warning: SourceNotice | null
}

/**
 * The MIME type of a file, trusting the extension when the browser supplies
 * none -- a drag from some file managers arrives with an empty `type`.
 */
function mimeOf(file: File): string | null {
  if (file.type in RASTER_TYPES || file.type === SVG_TYPE) return file.type
  const dot = file.name.lastIndexOf('.')
  return dot >= 0 ? (EXTENSION_TYPES[file.name.slice(dot).toLowerCase()] ?? null) : null
}

/** The format label a card shows: read from the data URL, since `type` says only raster or vector. */
export function sourceFormat(source: SourceImage): string {
  if (source.type === 'svg') return 'SVG'
  const mime = source.dataUrl.slice(5, source.dataUrl.indexOf(';'))
  return RASTER_TYPES[mime] ?? 'PNG'
}

export async function processFile(file: File): Promise<ProcessResult> {
  const mime = mimeOf(file)
  if (!mime) throw new SourceFileError('source.errorType')
  const isSvg = mime === SVG_TYPE

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new SourceFileError('source.readFailed'))
    reader.readAsDataURL(file)
  })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new SourceFileError('source.errorDecode'))
    img.src = dataUrl
  })

  const width = img.naturalWidth
  const height = img.naturalHeight

  let warning: SourceNotice | null = null
  if (width !== height) {
    warning = { key: 'source.warnNonSquare', params: { width, height } }
  } else if (!isSvg && width < 1024) {
    warning = { key: 'source.warnSmall', params: { width, height } }
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
