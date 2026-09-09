/**
 * ICO encoder.
 *
 * An ICO is a directory of frames. Format:
 *   [2 bytes] Reserved (0)
 *   [2 bytes] Image type (1 = ICO)
 *   [2 bytes] Number of images
 *   [16 bytes × N] Directory entries
 *   [N × data] Frame data
 *
 * Each directory entry:
 *   [1 byte]  Width (0 = 256)
 *   [1 byte]  Height (0 = 256)
 *   [1 byte]  Color count (0 for truecolor)
 *   [1 byte]  Reserved (0)
 *   [2 bytes] Color planes (1)
 *   [2 bytes] Bits per pixel (32)
 *   [4 bytes] Frame data size in bytes
 *   [4 bytes] Offset to frame data from start of file
 *
 * ## Why two frame encodings
 *
 * A frame is either a PNG or a DIB (a BITMAPINFOHEADER, the 32-bit BGRA pixels
 * bottom-up, then a 1-bit AND mask). Microsoft's guidance is that only the
 * 256×256 frame should be PNG-compressed and the smaller frames should stay
 * uncompressed: PNG frames are a Vista addition, and consumers outside Explorer
 * (older shell dialogs, resource tools, .NET's `Icon`) still mishandle them at
 * small sizes. So sizes under 256 are written as DIBs whenever the caller can
 * hand over pixels, and the 256 frame stays PNG, where a DIB would be 256 KB.
 *
 * Pixels are optional because a browser under fingerprinting protection returns
 * noise from `getImageData`; the caller detects that and passes none, and the
 * frame falls back to PNG rather than to garbage.
 */

import type { IconImageData } from './canvas-backend'

export interface IcoEntry {
  size: number
  /** The frame as a PNG. Always required; used as-is at 256 and as the fallback. */
  pngData: Uint8Array
  /** The same frame as straight-alpha RGBA, when a DIB can be written from it. */
  pixels?: IconImageData | null
}

/** Frames at or above this size are stored as PNG; below it, as DIB when possible. */
const PNG_FRAME_MIN = 256

/**
 * Encodes frames into an ICO file. Each entry carries the pixel size, the PNG
 * bytes, and optionally the raw pixels for a DIB frame.
 */
export function encodeIco(entries: IcoEntry[]): Uint8Array {
  const headerSize = 6 // ICONDIR
  const dirEntrySize = 16 // ICONDIRENTRY
  const dirSize = dirEntrySize * entries.length

  const frames = entries.map((entry) => ({
    size: entry.size,
    data:
      entry.size < PNG_FRAME_MIN && entry.pixels ? encodeDib(entry.pixels) : entry.pngData,
  }))

  let totalDataSize = 0
  for (const frame of frames) totalDataSize += frame.data.length
  const totalSize = headerSize + dirSize + totalDataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // ICONDIR header
  view.setUint16(0, 0, true) // Reserved
  view.setUint16(2, 1, true) // Type: 1 = ICO
  view.setUint16(4, frames.length, true) // Number of images

  let dataOffset = headerSize + dirSize

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const dirOffset = headerSize + i * dirEntrySize

    // Width and height: 0 means 256
    bytes[dirOffset] = frame.size >= 256 ? 0 : frame.size
    bytes[dirOffset + 1] = frame.size >= 256 ? 0 : frame.size
    bytes[dirOffset + 2] = 0 // Color count (0 = truecolor)
    bytes[dirOffset + 3] = 0 // Reserved
    view.setUint16(dirOffset + 4, 1, true) // Color planes
    view.setUint16(dirOffset + 6, 32, true) // Bits per pixel
    view.setUint32(dirOffset + 8, frame.data.length, true) // Data size
    view.setUint32(dirOffset + 12, dataOffset, true) // Data offset

    bytes.set(frame.data, dataOffset)
    dataOffset += frame.data.length
  }

  return bytes
}

/** Bytes per row of a 1-bit mask, padded to a 4-byte boundary. */
export function andMaskRowBytes(width: number): number {
  return ((width + 31) >> 5) << 2
}

/**
 * A 32-bit DIB frame: BITMAPINFOHEADER with the height doubled (XOR image plus
 * AND mask), BGRA rows bottom-up, then the 1-bit AND mask, bottom-up, set where
 * a pixel is fully transparent. Windows reads the alpha channel for 32-bit
 * frames and uses the mask only where alpha is absent, so the two agree.
 */
function encodeDib(pixels: IconImageData): Uint8Array {
  const { width, height, data } = pixels
  const xorRow = width * 4
  const andRow = andMaskRowBytes(width)
  const imageSize = xorRow * height + andRow * height
  const out = new Uint8Array(40 + imageSize)
  const view = new DataView(out.buffer)

  view.setUint32(0, 40, true) // biSize
  view.setInt32(4, width, true) // biWidth
  view.setInt32(8, height * 2, true) // biHeight: XOR + AND
  view.setUint16(12, 1, true) // biPlanes
  view.setUint16(14, 32, true) // biBitCount
  view.setUint32(16, 0, true) // biCompression: BI_RGB
  view.setUint32(20, imageSize, true) // biSizeImage
  // biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant stay 0.

  let o = 40
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      out[o++] = data[i + 2] // B
      out[o++] = data[i + 1] // G
      out[o++] = data[i] // R
      out[o++] = data[i + 3] // A
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) out[o + (x >> 3)] |= 0x80 >> (x & 7)
    }
    o += andRow
  }
  return out
}
