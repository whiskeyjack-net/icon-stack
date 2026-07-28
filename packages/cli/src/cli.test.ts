/**
 * CLI-level tests: argument handling, exit codes, and that `generate` actually
 * puts files on disk. The pipeline itself is covered in icon-stack-core; what
 * matters here is the boundary an agent or a script drives.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { main } from './cli'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const PNG = join(repoRoot, 'fixtures/mark.png')
const SVG = join(repoRoot, 'fixtures/mark.svg')

let out: string
let stdout: string[]
let stderr: string[]

beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), 'icon-stack-cli-'))
  stdout = []
  stderr = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk))
    return true
  })
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(String(chunk))
    return true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(out, { recursive: true, force: true })
})

const outText = () => stdout.join('')
const errText = () => stderr.join('')

describe('argument handling', () => {
  it('treats a bare invocation and a leading flag as help', async () => {
    expect(await main([])).toBe(0)
    expect(outText()).toContain('icon-stack --')

    stdout.length = 0
    expect(await main(['--help'])).toBe(0)
    expect(outText()).toContain('Usage')
  })

  it('honours --help after a command', async () => {
    expect(await main(['generate', '--help'])).toBe(0)
    expect(outText()).toContain('Usage')
  })

  it('rejects an unknown command', async () => {
    expect(await main(['bogus'])).toBe(1)
    expect(errText()).toContain('Unknown command')
  })

  it('rejects an unknown option', async () => {
    expect(await main(['generate', '--nope'])).toBe(1)
    expect(errText()).toContain('Unknown option')
  })

  it('requires a source for generate', async () => {
    expect(await main(['generate'])).toBe(1)
    expect(errText()).toContain('--source is required')
  })

  it('names the unknown platform and lists the valid ones', async () => {
    expect(await main(['generate', '-s', PNG, '-p', 'nonsense'])).toBe(1)
    expect(errText()).toContain('nonsense')
    expect(errText()).toContain('favicon')
  })

  it('validates the background colour', async () => {
    expect(await main(['generate', '-s', PNG, '-b', 'blue'])).toBe(1)
    expect(errText()).toContain('6-digit hex')
  })

  it('reports a missing source file by path', async () => {
    expect(await main(['generate', '-s', '/nope/missing.png'])).toBe(1)
    expect(errText()).toContain('Cannot read source image')
  })
})

describe('platforms', () => {
  it('lists platforms as JSON', async () => {
    expect(await main(['platforms', '--json'])).toBe(0)
    const list = JSON.parse(outText())
    expect(list.map((p: { id: string }) => p.id)).toContain('favicon')
  })
})

describe('inspect', () => {
  it('reports dimensions and squareness', async () => {
    expect(await main(['inspect', '-s', PNG, '--json'])).toBe(0)
    const info = JSON.parse(outText())
    expect(info).toMatchObject({ type: 'png', width: 1024, height: 1024, square: true })
    expect(info.warnings).toEqual([])
  })

  it('reads an SVG viewBox for dimensions', async () => {
    expect(await main(['inspect', '-s', SVG, '--json'])).toBe(0)
    const info = JSON.parse(outText())
    expect(info.type).toBe('svg')
    expect(info.width).toBeGreaterThan(0)
    expect(info.square).toBe(true)
  })
})

describe('generate', () => {
  it('writes the selected platforms to disk and reports them as JSON', async () => {
    expect(await main(['generate', '-s', PNG, '-o', out, '-p', 'pwa,favicon', '--json'])).toBe(0)

    const result = JSON.parse(outText())
    expect(result.platforms.sort()).toEqual(['favicon', 'pwa'])
    expect(result.files).toContain('favicon.ico')
    expect(result.files).toContain('pwa/icon-512.png')

    // The manifest must describe what is actually there.
    for (const f of result.files) {
      expect(existsSync(join(out, f)), `${f} missing on disk`).toBe(true)
      expect(readFileSync(join(out, f)).length).toBeGreaterThan(0)
    }
  })

  it('bakes a background when asked', async () => {
    expect(await main(['generate', '-s', PNG, '-o', out, '-p', 'pwa', '-b', '#1E90FF', '--json'])).toBe(0)
    const bytes = readFileSync(join(out, 'pwa/icon-512.png'))
    // A PNG with a flat colour behind the artwork is materially larger than
    // one whose surround is fully transparent.
    expect(bytes.length).toBeGreaterThan(1000)
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  })

  it('generates from an SVG source', async () => {
    expect(await main(['generate', '-s', SVG, '-o', out, '-p', 'favicon', '--json'])).toBe(0)
    const result = JSON.parse(outText())
    expect(result.files).toContain('favicon.svg')
    expect(result.files).toContain('favicon.ico')
    // Real artwork, not a blank canvas that silently failed to decode.
    expect(readFileSync(join(out, 'favicon.ico')).length).toBeGreaterThan(500)
  })

  it('is quiet with --quiet but still writes files', async () => {
    expect(await main(['generate', '-s', PNG, '-o', out, '-p', 'pwa', '--quiet'])).toBe(0)
    expect(outText().trim()).toBe('')
    expect(existsSync(join(out, 'pwa/icon-512.png'))).toBe(true)
  })
})
