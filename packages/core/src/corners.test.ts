/**
 * Which platforms bake a corner, checked against what the pipeline actually does.
 *
 * The two had drifted: `cornerRadius` and `cornerSmoothing` sat on the base
 * `PlatformConfig`, so ten platforms carried them while `generate.ts` read them on
 * five. The app dutifully rendered sliders for Android, Apple Touch, tray and
 * legacy iOS that moved and changed nothing.
 *
 * The type now says which platforms round, so this asserts the type and the
 * pipeline agree -- read from the source, because a config field is only a promise
 * until something honours it.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createDefaultPlatforms } from './defaults'
import type { Platform } from './types'

const generate = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'generate.ts'),
  'utf8',
)

const configs = createDefaultPlatforms()
const declared = (Object.keys(configs) as Platform[]).filter(
  (p) => 'cornerRadius' in (configs[p] as object),
)

/**
 * Platforms the OS shapes for you, which is why they carry no corner fields: iOS
 * and Apple Touch icons are masked by the system, an Android adaptive icon is
 * composited and masked by the launcher, and a tray icon is a 16-22px template
 * silhouette. A baked corner on any of them is cut a second time.
 */
const OS_SHAPED: Platform[] = ['android', 'appleTouchIcon', 'trayIcon', 'ios', 'apple']

describe('corner baking', () => {
  it('declares corners on exactly the platforms the OS does not shape', () => {
    expect(declared.sort()).toEqual(
      ['favicon', 'linux', 'macos', 'pwa', 'windows', 'windowsStore'].sort(),
    )
  })

  it('gives no corner fields to an OS-shaped platform', () => {
    for (const platform of OS_SHAPED) {
      expect('cornerRadius' in (configs[platform] as object), platform).toBe(false)
      expect('cornerSmoothing' in (configs[platform] as object), platform).toBe(false)
    }
  })

  it.each(declared)('the pipeline rounds %s', (platform) => {
    // Every rounding site reads `<name>Config.cornerRadius`, so the platform's
    // config variable has to appear in an applyRoundedCorners call.
    const calls = [...generate.matchAll(/applyRoundedCorners\([^)]*?(\w+)Config\.cornerRadius/g)].map(
      (m) => m[1].toLowerCase(),
    )
    const alias: Record<string, string> = { windows: 'win', windowsStore: 'store' }
    const expected = (alias[platform] ?? platform).toLowerCase()
    expect(calls, `no applyRoundedCorners for ${platform}`).toContain(expected)
  })

  it('legacy macOS rounds only when a background is baked', () => {
    // Nothing to clip otherwise, which is the same condition the settings UI uses
    // to decide whether to offer the sliders at all.
    const block = generate.slice(generate.indexOf('const generateMacosPng'))
    const body = block.slice(0, block.indexOf('\n    }'))
    expect(body).toMatch(/if \(bgFill && macosConfig\.cornerRadius > 0\)/)
  })
})
