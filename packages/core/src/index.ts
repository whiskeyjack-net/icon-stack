/**
 * Icon Stack core: platform size tables, container encoders, compositing, and
 * the icon-set generator -- with the rasterizer injected so the same code runs
 * in a browser and in Node.
 *
 * Install a backend once at startup:
 * ```ts
 * import { setCanvasBackend } from '@whiskeyjack-net/icon-stack-core'
 * import { browserCanvasBackend } from '@whiskeyjack-net/icon-stack-core/browser'
 * setCanvasBackend(browserCanvasBackend)
 * ```
 */
export { generateIcons, type GenerateOptions } from './generate'
export { buildZip, type ZipFile } from './zip-builder'
export { encodeIco } from './ico-encoder'
export { encodeIcns } from './icns-encoder'
export * from './color-utils'
export * from './platform-configs'
export * from './types'
export { createDefaultPlatforms, updatePlatform, selectPlatforms } from './defaults'
export {
  setCanvasBackend,
  getCanvasBackend,
  createCanvas,
  context2d,
  type CanvasBackend,
  type IconCanvas,
  type IconContext2D,
  type IconDrawable,
  type IconImageData,
  type IconGradient,
} from './canvas-backend'
export {
  loadImage,
  imageToCanvas,
  imageToSquareCanvas,
  resizeCanvas,
  canvasToPng,
} from './resize'
export * from './canvas-utils'
