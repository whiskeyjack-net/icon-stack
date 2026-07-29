/**
 * Locale integrity.
 *
 * Every check here exists because the failure it catches is invisible: a missing
 * key renders as its own path, a dropped `{{placeholder}}` renders the raw token,
 * and an unlisted locale file simply never loads. None of it is a type error and
 * none of it fails a build.
 *
 * The prompt was a real incident: re-keying `home.*` to `generator.*` dropped the
 * entire English block while Spanish kept the new one, and all thirteen app tests
 * stayed green because the only untranslated-key assertion pointed at the one
 * page that had not changed.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SUPPORTED_LANGUAGES } from '@/i18n'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'locales')

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort()

const load = (lang: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8'))

/** Every leaf key, dot-joined. */
function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  )
}

/** Every leaf value, keyed by its dot path. */
function flat(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value !== 'object' || value === null) return { [prefix]: String(value) }
  return Object.assign(
    {},
    ...Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      flat(v, prefix ? `${prefix}.${k}` : k),
    ),
  )
}

const reference = keys(load('en')).sort()
const referenceFlat = flat(load('en'))
const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()

describe('locales', () => {
  it('ships more than a token pair of languages', () => {
    // The rebuilt app launched with 2 where the original had 8, which is the
    // sort of regression that reads as a deliberate scope choice until someone
    // checks.
    expect(files.length).toBeGreaterThanOrEqual(8)
  })

  it('registers every locale file in the i18n bootstrap', () => {
    // A file nobody imports is dead weight that looks like support.
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(files)
  })

  it.each(files)('%s has exactly the keys en has', (lang) => {
    expect(keys(load(lang)).sort()).toEqual(reference)
  })

  it.each(files)('%s keeps every interpolation placeholder', (lang) => {
    const translated = flat(load(lang))
    for (const [key, english] of Object.entries(referenceFlat)) {
      expect(placeholders(translated[key]), `${lang}: ${key}`).toEqual(placeholders(english))
    }
  })

  it.each(files)('%s uses en dashes, never em dashes', (lang) => {
    // Repo-wide copywriting rule. Locale files are the easiest place for one to
    // slip in, since they are the only prose that never passes through JSX.
    for (const [key, value] of Object.entries(flat(load(lang)))) {
      // eslint-disable-next-line no-restricted-syntax -- the em dash IS the fixture; this is the test enforcing the ban.
      expect(value, `${lang}: ${key}`).not.toContain('—')
    }
  })

  it.each(files)('%s leaves no value empty', (lang) => {
    for (const [key, value] of Object.entries(flat(load(lang)))) {
      expect(value.trim(), `${lang}: ${key}`).not.toBe('')
    }
  })
})
