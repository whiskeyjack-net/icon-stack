/**
 * `pica` ships no type declarations, and this package currently exports raw TS
 * source (`main: ./src/index.ts`), so its untyped imports surface as errors in
 * whatever tsconfig the CONSUMER uses rather than this package's own. The real
 * fix is a dual-mode build that emits .d.ts, the way the design system does --
 * see FINDINGS.md. Until then, declare the sliver of the API the browser
 * adapter actually uses.
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
