/**
 * The surface a preview icon sits on.
 *
 * An icon is judged against a wallpaper, never against a card. A mark with a
 * transparent background, a pale plate, or a white outer edge looks fine on the
 * app's own surface and disappears on a real desktop -- and that is precisely the
 * failure worth catching before shipping the set.
 *
 * So the hero sits on a mesh gradient, and it can be re-rolled. Cycling through a
 * few backdrops is a faster and more honest check than reasoning about contrast:
 * either the icon holds up across all of them or it does not.
 */

export interface Backdrop {
  /** Base colour under the layers. */
  color: string
  /** `radial-gradient(...)` layers, outermost first. */
  layers: string[]
}

/** The starting backdrop, kept fixed so a first load looks the same every time. */
export const DEFAULT_BACKDROP: Backdrop = {
  color: '#99F8FF',
  layers: [
    'radial-gradient(at 77% 8%, hsla(292,74%,62%,1) 0px, transparent 50%)',
    'radial-gradient(at 38% 37%, hsla(59,93%,77%,1) 0px, transparent 50%)',
    'radial-gradient(at 24% 44%, hsla(162,96%,74%,1) 0px, transparent 50%)',
    'radial-gradient(at 10% 83%, hsla(220,89%,74%,1) 0px, transparent 50%)',
    'radial-gradient(at 64% 31%, hsla(263,91%,79%,1) 0px, transparent 50%)',
    'radial-gradient(at 26% 75%, hsla(86,86%,68%,1) 0px, transparent 50%)',
    'radial-gradient(at 40% 85%, hsla(114,88%,73%,1) 0px, transparent 50%)',
  ],
}

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

/**
 * A fresh backdrop.
 *
 * Saturation and lightness stay in a narrow high band on purpose. The point is
 * to vary the HUE under the icon while keeping every backdrop a plausible
 * wallpaper -- a randomiser that can produce near-black or near-white surfaces
 * would keep rolling backdrops that answer nothing.
 */
export function randomBackdrop(): Backdrop {
  return {
    color: `hsl(${randomInt(0, 360)}, ${randomInt(70, 100)}%, ${randomInt(70, 85)}%)`,
    layers: Array.from({ length: 7 }, () =>
      [
        `radial-gradient(at ${randomInt(0, 100)}% ${randomInt(0, 100)}%,`,
        `hsla(${randomInt(0, 360)},${randomInt(70, 100)}%,${randomInt(60, 85)}%,1)`,
        '0px, transparent 50%)',
      ].join(' '),
    ),
  }
}

/** The `style` values for a backdrop, ready to spread onto an element. */
export function backdropStyle(backdrop: Backdrop): { backgroundColor: string; backgroundImage: string } {
  return {
    backgroundColor: backdrop.color,
    backgroundImage: backdrop.layers.join(', '),
  }
}
