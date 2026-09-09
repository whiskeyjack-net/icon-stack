/**
 * Reads back what `encodeIco` writes.
 *
 * Two platforms export nothing but an ICO -- `windows` ships `app.ico` and
 * `favicon` ships `favicon.ico` -- so anything that wants to SEE those results,
 * rather than just write them, has to open the container. The app's preview
 * showed "no raster sizes" for both until this existed, which is a strange thing
 * for an icon generator to say about the icons it just generated.
 *
 * Frames come back in the form they were stored: a PNG frame as its bytes, a
 * DIB frame as straight-alpha RGBA pixels. The directory's width byte is one
 * byte and cannot express 256, so the size is read from the frame itself -- the
 * PNG's IHDR or the DIB's header -- which is authoritative and has no ceiling.
 *
 * Scope: the ICOs this library writes. That means 32-bit BI_RGB DIBs and PNGs.
 * Palettized or RLE frames are skipped rather than guessed at.
 */

import { andMaskRowBytes } from './ico-encoder'

export type DecodedIcoImage =
  | {
      kind: 'png'
      /** Pixel width, read from the PNG header. Square, as every entry here is. */
      size: number
      /** The embedded PNG, byte-for-byte as it was encoded. */
      pngData: Uint8Array
    }
  | {
      kind: 'bmp'
      size: number
      /** Straight-alpha RGBA, top-down, `size × size × 4` bytes. */
      rgba: Uint8ClampedArray
    }

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

/** Width from a PNG's IHDR, which always sits at a fixed offset. */
function pngWidth(bytes: Uint8Array): number {
  if (bytes.length < 24) return 0
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return 0
  }
  return (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
}

/**
 * A 32-bit BI_RGB DIB frame as RGBA. Alpha comes from the pixels; when a frame
 * carries none at all (every alpha byte zero, as pre-XP icons do) the AND mask
 * supplies it instead.
 */
function decodeDib(bytes: Uint8Array): DecodedIcoImage | null {
  if (bytes.length < 40) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== 40) return null
  const width = view.getInt32(4, true)
  const height = view.getInt32(8, true) / 2
  const bpp = view.getUint16(14, true)
  const compression = view.getUint32(16, true)
  if (width <= 0 || height <= 0 || width !== height || bpp !== 32 || compression !== 0) return null

  const xorRow = width * 4
  const andRow = andMaskRowBytes(width)
  if (bytes.length < 40 + xorRow * height + andRow * height) return null

  const rgba = new Uint8ClampedArray(width * height * 4)
  let anyAlpha = false
  for (let y = 0; y < height; y++) {
    const row = 40 + (height - 1 - y) * xorRow
    for (let x = 0; x < width; x++) {
      const s = row + x * 4
      const d = (y * width + x) * 4
      rgba[d] = bytes[s + 2]
      rgba[d + 1] = bytes[s + 1]
      rgba[d + 2] = bytes[s]
      rgba[d + 3] = bytes[s + 3]
      if (bytes[s + 3] !== 0) anyAlpha = true
    }
  }
  if (!anyAlpha) {
    const maskStart = 40 + xorRow * height
    for (let y = 0; y < height; y++) {
      const row = maskStart + (height - 1 - y) * andRow
      for (let x = 0; x < width; x++) {
        const masked = (bytes[row + (x >> 3)] >> (7 - (x & 7))) & 1
        rgba[(y * width + x) * 4 + 3] = masked ? 0 : 255
      }
    }
  }
  return { kind: 'bmp', size: width, rgba }
}

/**
 * Every image inside an ICO, ascending by size.
 *
 * Returns an empty array for anything that is not an ICO rather than throwing:
 * a caller previewing a directory of mixed output should skip a file it cannot
 * read, not fail the whole render.
 */
export function decodeIco(bytes: Uint8Array): DecodedIcoImage[] {
  // ICONDIR: reserved(2) + type(2) + count(2)
  if (bytes.length < 6) return []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint16(0, true) !== 0) return []
  if (view.getUint16(2, true) !== 1) return []

  const count = view.getUint16(4, true)
  if (count === 0 || bytes.length < 6 + count * 16) return []

  const images: DecodedIcoImage[] = []
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16
    const dataSize = view.getUint32(entry + 8, true)
    const offset = view.getUint32(entry + 12, true)
    if (offset + dataSize > bytes.length) continue

    const frame = bytes.slice(offset, offset + dataSize)
    const size = pngWidth(frame)
    if (size > 0) {
      images.push({ kind: 'png', size, pngData: frame })
      continue
    }
    const dib = decodeDib(frame)
    if (dib) images.push(dib)
  }

  return images.sort((a, b) => a.size - b.size)
}
