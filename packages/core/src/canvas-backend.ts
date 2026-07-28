/**
 * The one place this package touches a rasterizer.
 *
 * Icon generation is otherwise pure: size tables, `.ico`/`.icns` container
 * encoding, color maths, and the compositing logic are all platform-agnostic.
 * Only creating a canvas, decoding a source image, high-quality downscaling,
 * and encoding a PNG need a host.
 *
 * PLAN-08 originally scoped the Node path as a second, sharp-based pipeline.
 * That would have meant two renderers that could never agree byte-for-byte, in
 * a tool whose entire value is producing correct binary assets. Injecting a
 * backend instead keeps ONE implementation of every compositing rule: the
 * browser backs it with `document.createElement('canvas')`, Node backs it with
 * `@napi-rs/canvas` (Skia -- the same engine Chrome uses for canvas). The only
 * genuine divergence left is the downscaling kernel, which is why `resize` is
 * part of the port rather than something the core implements itself.
 *
 * The types below are the exact Canvas2D subset the compositing code uses --
 * verified against the source, not guessed. Both `HTMLCanvasElement` and
 * `@napi-rs/canvas`'s `Canvas` satisfy them structurally.
 */

export interface IconImageData {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
}

/** Anything drawable: a decoded image or another canvas. */
export interface IconDrawable {
  readonly width: number
  readonly height: number
}

export interface IconGradient {
  addColorStop(offset: number, color: string): void
}

export interface IconContext2D {
  fillStyle: string | IconGradient
  imageSmoothingEnabled: boolean
  imageSmoothingQuality: 'low' | 'medium' | 'high'

  fillRect(x: number, y: number, w: number, h: number): void
  clearRect(x: number, y: number, w: number, h: number): void

  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
  rect(x: number, y: number, w: number, h: number): void
  clip(): void

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): IconGradient
  getImageData(x: number, y: number, w: number, h: number): IconImageData
  putImageData(data: IconImageData, x: number, y: number): void

  drawImage(image: IconDrawable, dx: number, dy: number): void
  drawImage(image: IconDrawable, dx: number, dy: number, dw: number, dh: number): void
  drawImage(
    image: IconDrawable,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void
}

export interface IconCanvas extends IconDrawable {
  width: number
  height: number
  getContext(contextId: '2d'): IconContext2D | null
}

export interface CanvasBackend {
  /** A blank canvas with a transparent-black backing store. */
  createCanvas(width: number, height: number): IconCanvas
  /**
   * Decode a source image. `src` is a data URL (the browser's natural form) or
   * raw bytes. SVG must rasterize at the requested `width`/`height` when given,
   * so vector sources stay crisp -- see SVG_RASTER_SIZE in generate.ts.
   */
  loadImage(src: string | Uint8Array, size?: { width: number; height: number }): Promise<IconDrawable>
  /** High-quality downscale. The one place the two hosts legitimately differ. */
  resize(source: IconCanvas, width: number, height: number): Promise<IconCanvas>
  /** Encode to PNG bytes. */
  toPng(canvas: IconCanvas): Promise<Uint8Array>
}

let backend: CanvasBackend | null = null

/**
 * Install the host's rasterizer. Call once at startup:
 * `setCanvasBackend(browserCanvasBackend)` or `nodeCanvasBackend()`.
 */
export function setCanvasBackend(next: CanvasBackend): void {
  backend = next
}

export function getCanvasBackend(): CanvasBackend {
  if (!backend) {
    throw new Error(
      'No canvas backend installed. Call setCanvasBackend(browserCanvasBackend) ' +
        'in a browser, or setCanvasBackend(nodeCanvasBackend()) in Node, before generating icons.',
    )
  }
  return backend
}

/** Convenience wrappers so call sites read like the DOM code they replaced. */
export function createCanvas(width: number, height: number): IconCanvas {
  return getCanvasBackend().createCanvas(width, height)
}

/** `getContext('2d')` is nullable in the DOM types but never null in practice. */
export function context2d(canvas: IconCanvas): IconContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not acquire a 2D context')
  return ctx
}
