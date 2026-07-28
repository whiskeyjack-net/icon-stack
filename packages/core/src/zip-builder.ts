import { zipSync } from 'fflate'

export interface ZipFile {
  path: string
  data: Uint8Array
}

/**
 * Creates a ZIP file from an array of files.
 * Uses store mode (no compression) since PNGs are already compressed.
 */
export function buildZip(files: ZipFile[]): Uint8Array {
  const zipData: Record<string, Uint8Array> = {}

  for (const file of files) {
    zipData[file.path] = file.data
  }

  // Store mode: PNGs are already compressed. Returns bytes rather than a
  // Blob so the same code serves Node (write to disk) and the browser
  // (wrap in a Blob for download).
  return zipSync(zipData, { level: 0 })
}
