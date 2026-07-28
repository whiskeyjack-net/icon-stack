/**
 * `pica` ships no type declarations, and the browser adapter imports it.
 *
 * This shim belongs HERE, in the package that depends on pica. Before this
 * package emitted its own `.d.ts`, it exported raw TS source -- so a consumer's
 * tsc compiled these files under the consumer's config, and this missing
 * declaration became THEIR error, in an app that never touches pica. The build
 * fixed the leak; the shim itself was always legitimate.
 */
declare module 'pica' {
  interface PicaResizeOptions {
    quality?: 0 | 1 | 2 | 3
    alpha?: boolean
    unsharpAmount?: number
    unsharpRadius?: number
    unsharpThreshold?: number
  }
  export default class Pica {
    constructor(options?: { features?: string[] })
    resize(
      from: HTMLCanvasElement | HTMLImageElement,
      to: HTMLCanvasElement,
      options?: PicaResizeOptions,
    ): Promise<HTMLCanvasElement>
  }
}
