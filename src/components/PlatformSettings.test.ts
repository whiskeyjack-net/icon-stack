/**
 * Every platform config field must be reachable from the UI.
 *
 * Six were not, and had never been: `faviconSource`, `traySource`, `svgDarkMode`,
 * `maskableBgFill`, `unplatedBgFill`, `unplatedTransparent`. The core supported
 * all of them, the export honored all of them, and no control set any of them --
 * so the capability shipped and stayed unreachable. Nothing failed, which is why
 * it lasted.
 *
 * This is a text scan rather than a render test on purpose. A rendering test
 * would have to mount all eleven platforms with every conditional branch
 * satisfied to prove the same thing, and it would still pass if a field were
 * read but never written. Naming the field is the necessary condition, and the
 * failure message can point at the exact field.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDefaultPlatforms, type Platform } from '@whiskeyjack-net/icon-stack-core'

const componentsDir = dirname(fileURLToPath(import.meta.url))

/**
 * The files that between them are allowed to satisfy the requirement.
 *
 * `BackgroundField.tsx` is listed because it now owns the row and the toggle,
 * with `BackgroundEditor.tsx` behind it holding the drawer. Miss one of the two
 * and this check keeps passing while a field loses its only control.
 */
const UI = [
  'PlatformSettings.tsx',
  'BackgroundField.tsx',
  'BackgroundEditor.tsx',
  'DedicatedSource.tsx',
  'PlatformGrid.tsx',
]
  .map((f) => readFileSync(join(componentsDir, f), 'utf8'))
  .join('\n')

/**
 * Fields the UI legitimately does not surface as a control.
 *
 * `enabled` is the platform grid's job, and the grid is checked separately by
 * the app smoke tests. Keep this list short and justified -- it is the escape
 * hatch that would let the original bug back in.
 */
const NOT_A_CONTROL = new Set(['enabled'])

const configs = createDefaultPlatforms()

/** Every config field, with the platforms that carry it. */
const fields = new Map<string, Platform[]>()
for (const [platform, config] of Object.entries(configs)) {
  for (const key of Object.keys(config as object)) {
    fields.set(key, [...(fields.get(key) ?? []), platform as Platform])
  }
}

/**
 * Whether a control actually touches `field`.
 *
 * A plain `includes` is not enough, and proving that took a mutation test: it
 * reported `faviconSource` as covered when the only occurrence was inside
 * `t('platform.faviconSourceHint')`. Two separate ways to pass vacuously --
 *
 * - a longer field name containing this one (`faviconSource` in
 *   `faviconSourceHint`), fixed by the word boundary;
 * - an i18n key spelled identically to the field (`platform.svgDarkMode` for
 *   `svgDarkMode`), fixed by the lookbehind.
 *
 * So a translation string alone can no longer satisfy the requirement -- only a
 * reference to the field itself.
 */
function isReferenced(field: string): boolean {
  return new RegExp(String.raw`(?<!platform\.)\b${field}\b`).test(UI)
}

describe('platform config coverage', () => {
  it('finds a non-trivial number of fields, so a broken read cannot pass vacuously', () => {
    expect(fields.size).toBeGreaterThan(15)
  })

  it('rejects a field that only appears inside a translation key', () => {
    // Pins the matcher itself. Without this, the suite silently weakens the day
    // someone simplifies the regex back to a substring check.
    expect(new RegExp(String.raw`(?<!platform\.)\bmadeUpField\b`).test('t("platform.madeUpField")')).toBe(
      false,
    )
    expect(new RegExp(String.raw`(?<!platform\.)\bmadeUpField\b`).test('config.madeUpField')).toBe(true)
  })

  it.each([...fields.entries()].filter(([k]) => !NOT_A_CONTROL.has(k)))(
    '%s is referenced by a control',
    (field, platforms) => {
      expect(
        isReferenced(field),
        `${field} (on ${platforms.join(', ')}) is in the core config but no control references it. ` +
          `A translation string alone does not count. Either add a control, or add it to ` +
          `NOT_A_CONTROL with a reason.`,
      ).toBe(true)
    },
  )
})
