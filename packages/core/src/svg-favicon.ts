/**
 * The SVG favicon, composed the way the `.ico` is.
 *
 * `favicon.svg` used to be the source markup passed through untouched, which
 * meant the one file browsers now prefer ignored every favicon setting: no
 * plate, no rounded corner, no zoom, and a non-square source stayed non-square
 * while the `.ico` beside it was square. So a favicon set could be black-on-dark
 * in the tab bar in the ICO and white-on-nothing in the SVG.
 *
 * The source SVG is nested, whole, inside a square 1024 viewBox as an inner
 * `<svg>` -- its own viewBox, defs and styles intact -- and the plate, corner
 * clip and zoom are drawn around it with the same geometry `generate.ts` bakes
 * into the raster. Nesting rather than rewriting is what keeps arbitrary
 * exports from Illustrator or Figma safe: nothing inside is parsed except the
 * root element's own attributes.
 *
 * The dark-mode rule inverts the whole icon under `prefers-color-scheme: dark`
 * and rotates hue back, so a dark mark on a light plate becomes a light mark on
 * a dark plate with its colours kept. It is opt-in, because a mark drawn for a
 * dark tab bar is the other way round already.
 */
import { resolveGradientColors } from './color-utils'
import type { BackgroundFill, ImageFit } from './types'

/** The square the favicon is composed in. Large so the plate's corner is smooth at any raster size. */
export const SVG_FAVICON_SIZE = 1024

/** Superellipse exponent at 100% smoothing; the same constant the canvas path uses. */
const SMOOTHING_MAX_EXPONENT = 5

export interface SvgFaviconOptions {
  /** The source SVG document. */
  markup: string
  /** Intrinsic size, used only when the root has neither a viewBox nor width/height. */
  fallback: { width: number; height: number }
  fit: ImageFit
  zoom: number
  bgFill: BackgroundFill
  bgTransparent: boolean
  /** 0-50, percent of the icon's width. Only applies with a plate, as in the raster. */
  cornerRadius: number
  cornerSmoothing: number
  darkMode: boolean
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const fmt = (n: number) => String(Math.round(n * 1000) / 1000)

/**
 * The rounded-rectangle outline as an SVG path, matching `traceRoundedPath`:
 * quadratic corners at zero smoothing, sampled superellipse corners above it.
 */
export function roundedRectPath(w: number, h: number, r: number, smoothing: number): string {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  if (radius <= 0) return `M0 0H${fmt(w)}V${fmt(h)}H0Z`

  if (smoothing <= 0) {
    return [
      `M${fmt(radius)} 0`,
      `H${fmt(w - radius)}`,
      `Q${fmt(w)} 0 ${fmt(w)} ${fmt(radius)}`,
      `V${fmt(h - radius)}`,
      `Q${fmt(w)} ${fmt(h)} ${fmt(w - radius)} ${fmt(h)}`,
      `H${fmt(radius)}`,
      `Q0 ${fmt(h)} 0 ${fmt(h - radius)}`,
      `V${fmt(radius)}`,
      `Q0 0 ${fmt(radius)} 0`,
      'Z',
    ].join('')
  }

  const n = 2 + (Math.min(smoothing, 100) / 100) * (SMOOTHING_MAX_EXPONENT - 2)
  const pow = 2 / n
  const steps = 32
  const sample = (i: number) => {
    const t = (i / steps) * (Math.PI / 2)
    return [Math.pow(Math.sin(t), pow), Math.pow(Math.cos(t), pow)] as const
  }
  const pts: string[] = [`M${fmt(radius)} 0`, `L${fmt(w - radius)} 0`]
  for (let i = 0; i <= steps; i++) { const [s, c] = sample(i); pts.push(`L${fmt(w - radius + radius * s)} ${fmt(radius - radius * c)}`) }
  pts.push(`L${fmt(w)} ${fmt(h - radius)}`)
  for (let i = 0; i <= steps; i++) { const [s, c] = sample(i); pts.push(`L${fmt(w - radius + radius * c)} ${fmt(h - radius + radius * s)}`) }
  pts.push(`L${fmt(radius)} ${fmt(h)}`)
  for (let i = 0; i <= steps; i++) { const [s, c] = sample(i); pts.push(`L${fmt(radius - radius * s)} ${fmt(h - radius + radius * c)}`) }
  pts.push(`L0 ${fmt(radius)}`)
  for (let i = 0; i <= steps; i++) { const [s, c] = sample(i); pts.push(`L${fmt(radius - radius * c)} ${fmt(radius - radius * s)}`) }
  pts.push('Z')
  return pts.join('')
}

interface RootTag {
  /** Attributes of the root `<svg>`, minus the ones this composition owns. */
  attrs: Map<string, string>
  /** Everything after the root's opening tag, including the closing `</svg>`. */
  body: string
  /** True when the root element is self-closing (`<svg .../>`), i.e. empty. */
  empty: boolean
}

/** Split a document into its root `<svg>` attributes and body, dropping prolog, doctype and comments before it. */
function parseRoot(markup: string): RootTag | null {
  const stripped = markup.replace(/^\uFEFF/, '').replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  const open = stripped.match(/<svg\b([^>]*?)(\/?)>/i)
  if (!open || open.index === undefined) return null
  const attrs = new Map<string, string>()
  for (const m of open[1].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs.set(m[1], m[2] ?? m[3] ?? '')
  }
  const empty = open[2] === '/'
  const body = empty ? '</svg>' : stripped.slice(open.index + open[0].length)
  return { attrs, body, empty }
}

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Compose the favicon SVG. Returns `null` when the markup has no `<svg>` root to work with. */
export function composeSvgFavicon(options: SvgFaviconOptions): string | null {
  const root = parseRoot(options.markup)
  if (!root) return null

  // The artwork's own coordinate system: its viewBox, else its width/height,
  // else the intrinsic size the host decoded it at.
  const parseLen = (v: string | undefined) => (v === undefined ? NaN : parseFloat(v))
  let viewBox = root.attrs.get('viewBox')?.trim()
  if (!viewBox || viewBox.split(/[\s,]+/).length !== 4) {
    const w = parseLen(root.attrs.get('width'))
    const h = parseLen(root.attrs.get('height'))
    viewBox = `0 0 ${w > 0 ? fmt(w) : fmt(options.fallback.width)} ${h > 0 ? fmt(h) : fmt(options.fallback.height)}`
  }

  const S = SVG_FAVICON_SIZE
  const box = (S * options.zoom) / 100
  const offset = (S - box) / 2

  for (const owned of ['x', 'y', 'width', 'height', 'viewBox', 'preserveAspectRatio']) root.attrs.delete(owned)
  if (!root.attrs.has('xmlns')) root.attrs.set('xmlns', SVG_NS)
  const innerAttrs = [
    ...[...root.attrs].map(([k, v]) => `${k}="${escapeAttr(v)}"`),
    `x="${fmt(offset)}"`,
    `y="${fmt(offset)}"`,
    `width="${fmt(box)}"`,
    `height="${fmt(box)}"`,
    `viewBox="${escapeAttr(viewBox)}"`,
    `preserveAspectRatio="xMidYMid ${options.fit === 'cover' ? 'slice' : 'meet'}"`,
  ].join(' ')
  const artwork = `<svg ${innerAttrs}>${root.body}`

  const plated = !options.bgTransparent
  const rounded = plated && options.cornerRadius > 0
  const defs: string[] = []
  let plate = ''
  if (plated) {
    if (options.bgFill.type === 'solid') {
      plate = `<rect width="${S}" height="${S}" fill="${escapeAttr(options.bgFill.color)}"/>`
    } else {
      const { top, bottom } = resolveGradientColors(options.bgFill.gradient)
      defs.push(
        `<linearGradient id="wj-plate" x1="0.5" y1="0" x2="0.5" y2="1">` +
          `<stop offset="0" stop-color="${escapeAttr(top)}"/><stop offset="1" stop-color="${escapeAttr(bottom)}"/></linearGradient>`,
      )
      plate = `<rect width="${S}" height="${S}" fill="url(#wj-plate)"/>`
    }
  }
  if (rounded) {
    const r = (options.cornerRadius / 100) * S
    defs.push(`<clipPath id="wj-shape"><path d="${roundedRectPath(S, S, r, options.cornerSmoothing)}"/></clipPath>`)
  }

  const style = options.darkMode
    ? `<style>@media (prefers-color-scheme: dark){#wj-icon{filter:invert(1) hue-rotate(180deg)}}</style>`
    : ''

  return (
    `<svg xmlns="${SVG_NS}" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    style +
    `<g id="wj-icon"${rounded ? ' clip-path="url(#wj-shape)"' : ''}>` +
    plate +
    artwork +
    `</g></svg>`
  )
}
