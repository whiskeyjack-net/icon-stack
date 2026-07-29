import { describe, expect, it } from 'vitest'
import { encodeIco } from './ico-encoder'
import { decodeIco } from './ico-decoder'

/** A minimal valid PNG header carrying a square size in its IHDR. */
function fakePng(size: number, filler = 0): Uint8Array {
  const b = new Uint8Array(40).fill(filler, 24)
  b[0] = 0x89
  b[1] = 0x50
  b[2] = 0x4e
  b[3] = 0x47
  for (const offset of [16, 20]) {
    b[offset] = (size >> 24) & 0xff
    b[offset + 1] = (size >> 16) & 0xff
    b[offset + 2] = (size >> 8) & 0xff
    b[offset + 3] = size & 0xff
  }
  return b
}

describe('decodeIco', () => {
  it('round-trips everything the encoder writes', () => {
    const sizes = [16, 24, 32, 48, 64, 128, 256]
    const ico = encodeIco(sizes.map((size) => ({ size, pngData: fakePng(size, size) })))

    const decoded = decodeIco(ico)
    expect(decoded.map((i) => i.size)).toEqual(sizes)
    // Byte-for-byte, because the preview renders these directly.
    for (const [i, size] of sizes.entries()) {
      expect(decoded[i].pngData).toEqual(fakePng(size, size))
    }
  })

  it('reads 256 from the PNG header, which the directory byte cannot hold', () => {
    // The ICONDIRENTRY width is one byte, so 256 is stored as 0. Trusting it
    // would report every 256px icon as a zero-sized one.
    const decoded = decodeIco(encodeIco([{ size: 256, pngData: fakePng(256) }]))
    expect(decoded).toHaveLength(1)
    expect(decoded[0].size).toBe(256)
  })

  it('returns nothing for input that is not an ICO, rather than throwing', () => {
    // A caller walking a directory of mixed output should skip what it cannot
    // read instead of failing the whole render.
    expect(decodeIco(new Uint8Array())).toEqual([])
    expect(decodeIco(new Uint8Array([1, 2, 3]))).toEqual([])
    expect(decodeIco(fakePng(32))).toEqual([])
  })

  it('skips an entry pointing past the end of the file', () => {
    const ico = encodeIco([{ size: 32, pngData: fakePng(32) }])
    const truncated = ico.slice(0, ico.length - 10)
    expect(decodeIco(truncated)).toEqual([])
  })

  it('sorts ascending however the entries were written', () => {
    const ico = encodeIco([
      { size: 256, pngData: fakePng(256) },
      { size: 16, pngData: fakePng(16) },
      { size: 64, pngData: fakePng(64) },
    ])
    expect(decodeIco(ico).map((i) => i.size)).toEqual([16, 64, 256])
  })
})
