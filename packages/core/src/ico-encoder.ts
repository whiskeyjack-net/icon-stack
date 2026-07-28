/**
 * Custom ICO encoder for the browser.
 *
 * ICO files contain one or more PNG images with a directory header.
 * Format:
 *   [2 bytes] Reserved (0)
 *   [2 bytes] Image type (1 = ICO)
 *   [2 bytes] Number of images
 *   [16 bytes × N] Directory entries
 *   [N × data] PNG image data
 *
 * Each directory entry:
 *   [1 byte]  Width (0 = 256)
 *   [1 byte]  Height (0 = 256)
 *   [1 byte]  Color count (0 for truecolor)
 *   [1 byte]  Reserved (0)
 *   [2 bytes] Color planes (1)
 *   [2 bytes] Bits per pixel (32)
 *   [4 bytes] Image data size in bytes
 *   [4 bytes] Offset to image data from start of file
 */

interface IcoEntry {
  size: number
  pngData: Uint8Array
}

/**
 * Encodes PNG images into an ICO file.
 * Each entry should have the pixel size and the raw PNG bytes.
 */
export function encodeIco(entries: IcoEntry[]): Uint8Array {
  const headerSize = 6 // ICONDIR
  const dirEntrySize = 16 // ICONDIRENTRY
  const dirSize = dirEntrySize * entries.length

  // Calculate total file size
  let totalDataSize = 0
  for (const entry of entries) {
    totalDataSize += entry.pngData.length
  }
  const totalSize = headerSize + dirSize + totalDataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // ICONDIR header
  view.setUint16(0, 0, true) // Reserved
  view.setUint16(2, 1, true) // Type: 1 = ICO
  view.setUint16(4, entries.length, true) // Number of images

  // ICONDIRENTRY entries + image data
  let dataOffset = headerSize + dirSize

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const dirOffset = headerSize + i * dirEntrySize

    // Width and height: 0 means 256
    bytes[dirOffset] = entry.size >= 256 ? 0 : entry.size
    bytes[dirOffset + 1] = entry.size >= 256 ? 0 : entry.size
    bytes[dirOffset + 2] = 0 // Color count (0 = truecolor)
    bytes[dirOffset + 3] = 0 // Reserved
    view.setUint16(dirOffset + 4, 1, true) // Color planes
    view.setUint16(dirOffset + 6, 32, true) // Bits per pixel
    view.setUint32(dirOffset + 8, entry.pngData.length, true) // Data size
    view.setUint32(dirOffset + 12, dataOffset, true) // Data offset

    // Write PNG data
    bytes.set(entry.pngData, dataOffset)
    dataOffset += entry.pngData.length
  }

  return bytes
}
