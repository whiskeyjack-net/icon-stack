/**
 * Reads back what `encodeIco` writes.
 *
 * Two platforms export nothing but an ICO -- `windows` ships `app.ico` and
 * `favicon` ships `favicon.ico` -- so anything that wants to SEE those results,
 * rather than just write them, has to open the container. The app's preview
 * showed "no raster sizes" for both until this existed, which is a strange thing
 * for an icon generator to say about the icons it just generated.
 *
 * The directory's width byte is one byte, so it cannot express 256 and stores 0
 * instead. Rather than special-case that, the size is read from each embedded
 * PNG's IHDR, which is authoritative and has no such ceiling.
 *
 * Scope: this reads the ICOs this library writes, which always embed PNGs. A
 * general ICO reader would also have to handle BMP-encoded entries, with their
 * doubled height and AND mask. Nothing here produces those, and inventing a
 * decoder for a format we never emit would be untested code by construction.
 */

export interface DecodedIcoImage {
  /** Pixel width, read from the PNG header. Square, as every entry here is. */
  size: number
  /** The embedded PNG, byte-for-byte as it was encoded. */
  pngData: Uint8Array
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
 * Every image inside an ICO, ascending by size.
 *
 * Returns an empty array for anything that is not a PNG-bearing ICO rather than
 * throwing: a caller previewing a directory of mixed output should skip a file
 * it cannot read, not fail the whole render.
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

    const pngData = bytes.slice(offset, offset + dataSize)
    const size = pngWidth(pngData)
    // A zero width means the entry is not a PNG -- a BMP entry, or a truncated
    // file. Skipped rather than guessed at from the directory byte.
    if (size > 0) images.push({ size, pngData })
  }

  return images.sort((a, b) => a.size - b.size)
}
