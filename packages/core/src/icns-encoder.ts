/**
 * Custom ICNS encoder for the browser.
 *
 * Modern ICNS files (macOS 10.7+) use PNG-compressed entries.
 * The format is a simple binary container:
 *
 *   [4 bytes] 'icns' magic number
 *   [4 bytes] total file length (big-endian u32)
 *   [entry]*:
 *     [4 bytes] OSType code (e.g. 'ic07')
 *     [4 bytes] 8 + PNG data length (big-endian u32)
 *     [N bytes] raw PNG data
 */

interface IcnsEntry {
  osType: string
  pngData: Uint8Array
}

const ICNS_MAGIC = 0x69636E73 // 'icns'

/**
 * Encodes an array of PNG images into an ICNS file.
 * Returns the ICNS file as a Uint8Array.
 */
export function encodeIcns(entries: IcnsEntry[]): Uint8Array {
  // Calculate total file size
  let totalSize = 8 // header: magic (4) + file length (4)
  for (const entry of entries) {
    totalSize += 8 + entry.pngData.length // entry header (8) + PNG data
  }

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // Write file header
  view.setUint32(0, ICNS_MAGIC)
  view.setUint32(4, totalSize)

  // Write entries
  let offset = 8
  for (const entry of entries) {
    // OSType code (4 ASCII chars)
    for (let i = 0; i < 4; i++) {
      bytes[offset + i] = entry.osType.charCodeAt(i)
    }
    // Entry length
    view.setUint32(offset + 4, 8 + entry.pngData.length)
    // PNG data
    bytes.set(entry.pngData, offset + 8)

    offset += 8 + entry.pngData.length
  }

  return bytes
}
