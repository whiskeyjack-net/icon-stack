import type { BackgroundFill, GradientFill } from './types'

/** Convert hex (#RRGGBB) to HSL [h: 0-360, s: 0-100, l: 0-100] */
function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return [0, 0, l * 100]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let hue = 0
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) hue = ((b - r) / d + 2) / 6
  else hue = ((r - g) / d + 4) / 6

  return [hue * 360, s * 100, l * 100]
}

/** Convert HSL [h: 0-360, s: 0-100, l: 0-100] to hex (#RRGGBB) */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100
  const lN = l / 100

  const a = sN * Math.min(lN, 1 - lN)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color)))
      .toString(16)
      .padStart(2, '0')
  }

  return `#${f(0)}${f(8)}${f(4)}`
}

/** Generate a lighter shade of a hex color (for "auto" gradient top color) */
export function autoLighten(hex: string): string {
  const [h, s, l] = hexToHsl(hex)
  const increment = l > 80 ? 10 : 25
  const newL = Math.min(95, l + increment)
  return hslToHex(h, s, newL)
}

/** Resolve gradient colors, expanding 'auto' topColor to a computed value */
export function resolveGradientColors(gradient: GradientFill): { top: string; bottom: string } {
  return {
    top: gradient.topColor === 'auto' ? autoLighten(gradient.bottomColor) : gradient.topColor,
    bottom: gradient.bottomColor,
  }
}

/** Get a single representative color from a fill (for contexts needing one color) */
export function resolveFillColor(fill: BackgroundFill): string {
  if (fill.type === 'solid') return fill.color
  return fill.gradient.bottomColor
}

/** Get CSS background value for a fill (for previews) */
export function fillToCss(fill: BackgroundFill): string {
  if (fill.type === 'solid') return fill.color
  const { top, bottom } = resolveGradientColors(fill.gradient)
  return `linear-gradient(to bottom, ${top}, ${bottom})`
}
