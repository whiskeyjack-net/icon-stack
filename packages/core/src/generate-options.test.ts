/**
 * The generator options a UI actually drives: exporting several platforms at
 * once, pointing a variant at the alternate source, and the Apple `.icon`
 * settings.
 *
 * These are checked by *difference* rather than by asserting exact bytes. What
 * matters is that a setting reaches the output at all -- a control wired to a
 * field the pipeline ignores looks perfectly fine in the UI and produces
 * identical files, which is the failure this catches.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

import { setCanvasBackend } from './canvas-backend'
import { nodeCanvasBackend } from './adapters/node'
import { generateIcons } from './generate'
import { createDefaultPlatforms, selectPlatforms, updatePlatform } from './defaults'
import type { Platform, PlatformConfigs, SourceImage } from './types'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const dataUrl = (path: string, mime: string) =>
  `data:${mime};base64,${readFileSync(join(repoRoot, path)).toString('base64')}`

const mainSource: SourceImage = {
  type: 'png',
  dataUrl: dataUrl('fixtures/mark.png', 'image/png'),
  width: 1024,
  height: 1024,
}

/** Visibly different from the PNG fixture, so a swap is detectable. */
const altSource: SourceImage = {
  type: 'svg',
  dataUrl: dataUrl('fixtures/mark.svg', 'image/svg+xml'),
  width: 256,
  height: 256,
  svgText: readFileSync(join(repoRoot, 'fixtures/mark.svg'), 'utf8'),
}

function run(platforms: PlatformConfigs, alternate: SourceImage | null = null) {
  return generateIcons({
    source: mainSource,
    alternate,
    platforms,
    sourceFit: 'contain',
    alternateFit: 'contain',
    faviconFit: 'contain',
    trayFit: 'contain',
    onProgress: () => {},
  }).then(unzipSync)
}

beforeAll(async () => {
  setCanvasBackend(await nodeCanvasBackend())
})

describe('exporting several platforms at once', () => {
  it('includes every enabled platform and nothing else', async () => {
    const enabled: Platform[] = ['favicon', 'pwa', 'linux', 'android']
    const files = await run(selectPlatforms(createDefaultPlatforms(), enabled))
    const names = Object.keys(files)

    expect(names).toContain('favicon.ico')
    expect(names.some((n) => n.startsWith('pwa/'))).toBe(true)
    expect(names.some((n) => n.startsWith('linux/'))).toBe(true)
    expect(names.some((n) => n.startsWith('android/'))).toBe(true)

    // Disabled platforms must not leak in.
    expect(names.some((n) => n.startsWith('windows'))).toBe(false)
    expect(names.some((n) => n.includes('.iconset'))).toBe(false)
  })

  it('produces the same files as generating each platform alone', async () => {
    const enabled: Platform[] = ['favicon', 'pwa']
    const together = Object.keys(await run(selectPlatforms(createDefaultPlatforms(), enabled)))
    const separate: string[] = []
    for (const one of enabled) {
      separate.push(...Object.keys(await run(selectPlatforms(createDefaultPlatforms(), [one]))))
    }
    expect(together.sort()).toEqual(separate.sort())
  })
})

describe('alternate source selection', () => {
  it('changes the output for the variant it is selected for', async () => {
    let configs = selectPlatforms(createDefaultPlatforms(), ['android'])
    configs = updatePlatform(configs, 'android', {
      useMonochrome: true,
      monoSourceChoice: 'main',
    })
    const fromMain = await run(configs, altSource)

    configs = updatePlatform(configs, 'android', { monoSourceChoice: 'alternate' })
    const fromAlternate = await run(configs, altSource)

    const a = fromMain['android/ic_launcher_monochrome.png']
    const b = fromAlternate['android/ic_launcher_monochrome.png']
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  it('leaves other variants untouched when only one is switched', async () => {
    let configs = selectPlatforms(createDefaultPlatforms(), ['pwa'])
    const before = await run(configs, altSource)

    // Only the maskable variant moves to the alternate.
    configs = updatePlatform(configs, 'pwa', { maskableSourceChoice: 'alternate' })
    const after = await run(configs, altSource)

    expect(
      Buffer.from(before['pwa/icon-512.png']).equals(Buffer.from(after['pwa/icon-512.png'])),
    ).toBe(true)
    expect(
      Buffer.from(before['pwa/icon-maskable-512.png']).equals(
        Buffer.from(after['pwa/icon-maskable-512.png']),
      ),
    ).toBe(false)
  })
})

describe('Apple .icon settings', () => {
  it('glass and shadow reach the emitted icon.json', async () => {
    let configs = selectPlatforms(createDefaultPlatforms(), ['apple'])

    configs = updatePlatform(configs, 'apple', {
      glass: false,
      shadow: { kind: 'neutral', opacity: 0 },
    })
    const off = await run(configs)

    configs = updatePlatform(configs, 'apple', {
      glass: true,
      shadow: { kind: 'neutral', opacity: 0.9 },
    })
    const on = await run(configs)

    const decode = (files: Record<string, Uint8Array>) =>
      JSON.parse(new TextDecoder().decode(files['apple/AppIcon.icon/icon.json']))

    expect(decode(off)).not.toEqual(decode(on))
  })

  it('emits the .icon bundle with its asset layer', async () => {
    const files = await run(selectPlatforms(createDefaultPlatforms(), ['apple']))
    const names = Object.keys(files)
    expect(names).toContain('apple/AppIcon.icon/icon.json')
    expect(names.some((n) => n.startsWith('apple/AppIcon.icon/Assets/'))).toBe(true)
  })
})
