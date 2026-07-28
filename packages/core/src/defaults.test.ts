/**
 * The per-platform config helpers.
 *
 * These exist for a typing reason as much as a convenience one: writing
 * `configs[key] = {...}` where `key` is a `Platform` union requires the value to
 * satisfy the INTERSECTION of every config shape, which no single config does.
 * Every consumer otherwise reaches for `Object.assign` or a cast. The tests
 * below pin the behaviour; the type-checker pins the rest by compiling this file.
 */
import { describe, it, expect } from 'vitest'
import { createDefaultPlatforms, updatePlatform, selectPlatforms } from './defaults'
import type { Platform } from './types'

describe('updatePlatform', () => {
  it('applies the patch to the named platform only', () => {
    const base = createDefaultPlatforms()
    const next = updatePlatform(base, 'linux', { zoom: 80, cornerRadius: 20 })

    expect(next.linux.zoom).toBe(80)
    expect(next.linux.cornerRadius).toBe(20)
    expect(next.pwa.zoom).toBe(base.pwa.zoom)
  })

  it('does not mutate the input', () => {
    const base = createDefaultPlatforms()
    const before = base.linux.zoom
    updatePlatform(base, 'linux', { zoom: 42 })
    expect(base.linux.zoom).toBe(before)
  })

  it('preserves fields the patch does not mention', () => {
    const base = createDefaultPlatforms()
    const next = updatePlatform(base, 'favicon', { zoom: 120 })
    expect(next.favicon.includeSvg).toBe(base.favicon.includeSvg)
    expect(next.favicon.enabled).toBe(base.favicon.enabled)
  })

  it('accepts platform-specific fields', () => {
    const base = createDefaultPlatforms()
    // `useMonochrome` exists on AndroidConfig only -- the generic pins the key
    // to android, so this compiles here and would not for, say, 'linux'.
    const next = updatePlatform(base, 'android', { useMonochrome: true })
    expect(next.android.useMonochrome).toBe(true)
  })
})

describe('selectPlatforms', () => {
  it('enables exactly the named platforms', () => {
    const next = selectPlatforms(createDefaultPlatforms(), ['pwa', 'favicon'])
    const enabled = (Object.keys(next) as Platform[]).filter((k) => next[k].enabled)
    expect(enabled.sort()).toEqual(['favicon', 'pwa'])
  })

  it('preserves every other setting while flipping enabled', () => {
    const base = updatePlatform(createDefaultPlatforms(), 'linux', { zoom: 65 })
    const next = selectPlatforms(base, ['linux'])

    expect(next.linux.zoom).toBe(65)
    expect(next.linux.enabled).toBe(true)
    // A disabled platform keeps its config, so re-selecting it restores the work.
    expect(next.pwa.zoom).toBe(base.pwa.zoom)
    expect(next.pwa.enabled).toBe(false)
  })

  it('disables everything when given an empty list', () => {
    const next = selectPlatforms(createDefaultPlatforms(), [])
    expect((Object.keys(next) as Platform[]).some((k) => next[k].enabled)).toBe(false)
  })

  it('returns every platform key, not a subset', () => {
    const base = createDefaultPlatforms()
    const next = selectPlatforms(base, ['pwa'])
    expect(Object.keys(next).sort()).toEqual(Object.keys(base).sort())
  })
})
