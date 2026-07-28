import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  createDefaultPlatforms,
  generateIcons,
  selectPlatforms,
  updatePlatform,
  type ImageFit,
  type Platform,
  type PlatformConfigs,
  type SourceImage,
} from '@whiskeyjack-net/icon-stack-core'
import { unzipSync } from 'fflate'

/** Platforms exposed in the UI, in the order the tabs present them. */
export const PLATFORMS: Platform[] = [
  'favicon',
  'pwa',
  'windows',
  'windowsStore',
  'linux',
  'android',
  'apple',
  'macos',
  'ios',
  'appleTouchIcon',
  'trayIcon',
]

/** Which slot a `SourceImage` fills. */
export type SourceSlot = 'main' | 'alternate'

interface GeneratorValue {
  source: SourceImage | null
  alternate: SourceImage | null
  sourceWarning: string | null
  alternateWarning: string | null
  platforms: PlatformConfigs
  selected: Platform
  sourceFit: ImageFit
  alternateFit: ImageFit
  busy: boolean
  exporting: Platform | 'all' | null
  progress: number
  error: string | null

  setSlot: (slot: SourceSlot, source: SourceImage | null, warning?: string | null) => void
  setSelected: (platform: Platform) => void
  setFit: (slot: SourceSlot, fit: ImageFit) => void
  patchPlatform: <K extends Platform>(platform: K, patch: Partial<PlatformConfigs[K]>) => void
  togglePlatform: (platform: Platform) => void
  generate: (which: Platform | 'all') => Promise<void>
  /** Renders one platform and returns its files, for the live preview. */
  render: (platform: Platform) => Promise<Record<string, Uint8Array>>
}

const GeneratorContext = createContext<GeneratorValue | null>(null)

export function useGenerator(): GeneratorValue {
  const ctx = useContext(GeneratorContext)
  if (!ctx) throw new Error('useGenerator must be used inside a GeneratorProvider')
  return ctx
}

export function GeneratorProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<SourceImage | null>(null)
  const [alternate, setAlternate] = useState<SourceImage | null>(null)
  const [sourceWarning, setSourceWarning] = useState<string | null>(null)
  const [alternateWarning, setAlternateWarning] = useState<string | null>(null)
  const [platforms, setPlatforms] = useState(createDefaultPlatforms)
  const [selected, setSelected] = useState<Platform>('favicon')
  const [sourceFit, setSourceFit] = useState<ImageFit>('contain')
  const [alternateFit, setAlternateFit] = useState<ImageFit>('contain')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState<Platform | 'all' | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const setSlot = useCallback(
    (slot: SourceSlot, next: SourceImage | null, warning: string | null = null) => {
      setError(null)
      if (slot === 'main') {
        setSource(next)
        setSourceWarning(warning)
      } else {
        setAlternate(next)
        setAlternateWarning(warning)
        // Dropping the alternate would leave platforms pointing at a source that
        // no longer exists. The core falls back silently, but the UI would keep
        // claiming otherwise -- so reset the choices to match reality.
        if (!next) setPlatforms((prev) => resetAlternateChoices(prev))
      }
    },
    [],
  )

  const setFit = useCallback((slot: SourceSlot, fit: ImageFit) => {
    ;(slot === 'main' ? setSourceFit : setAlternateFit)(fit)
  }, [])

  const patchPlatform = useCallback(
    <K extends Platform>(platform: K, patch: Partial<PlatformConfigs[K]>) => {
      setPlatforms((prev) => updatePlatform(prev, platform, patch))
    },
    [],
  )

  const togglePlatform = useCallback((platform: Platform) => {
    setPlatforms((prev) => updatePlatform(prev, platform, { enabled: !prev[platform].enabled }))
  }, [])

  const buildOptions = useCallback(
    (which: Platform | 'all') => ({
      source: source as SourceImage,
      alternate,
      platforms:
        which === 'all'
          ? selectPlatforms(
              platforms,
              PLATFORMS.filter((p) => platforms[p].enabled),
            )
          : selectPlatforms(platforms, [which]),
      sourceFit,
      alternateFit,
      // The dedicated favicon/tray sources carry their own images; when unset
      // those platforms fall back to the main source, so its fit applies.
      faviconFit: sourceFit,
      trayFit: sourceFit,
    }),
    [source, alternate, platforms, sourceFit, alternateFit],
  )

  const render = useCallback(
    async (platform: Platform) => {
      if (!source) return {}
      const zip = await generateIcons({ ...buildOptions(platform), onProgress: () => {} })
      return unzipSync(zip)
    },
    [source, buildOptions],
  )

  const generate = useCallback(
    async (which: Platform | 'all') => {
      if (!source) return
      setBusy(true)
      setExporting(which)
      setError(null)
      setProgress(0)
      try {
        const zip = await generateIcons({ ...buildOptions(which), onProgress: setProgress })
        const name = which === 'all' ? 'all-platforms' : which
        const url = URL.createObjectURL(
          new Blob([zip as unknown as BlobPart], { type: 'application/zip' }),
        )
        const a = document.createElement('a')
        a.href = url
        a.download = `icon-stack-${name}-${Date.now()}.zip`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Generation failed.')
      } finally {
        setBusy(false)
        setExporting(null)
        setProgress(0)
      }
    },
    [source, buildOptions],
  )

  const value = useMemo<GeneratorValue>(
    () => ({
      source,
      alternate,
      sourceWarning,
      alternateWarning,
      platforms,
      selected,
      sourceFit,
      alternateFit,
      busy,
      exporting,
      progress,
      error,
      setSlot,
      setSelected,
      setFit,
      patchPlatform,
      togglePlatform,
      generate,
      render,
    }),
    [
      source,
      alternate,
      sourceWarning,
      alternateWarning,
      platforms,
      selected,
      sourceFit,
      alternateFit,
      busy,
      exporting,
      progress,
      error,
      setSlot,
      setFit,
      patchPlatform,
      togglePlatform,
      generate,
      render,
    ],
  )

  return <GeneratorContext.Provider value={value}>{children}</GeneratorContext.Provider>
}

/**
 * Point every `alternate` source choice back at the main source. Called when the
 * alternate image is removed, so no platform is left referencing an image that
 * is gone.
 */
function resetAlternateChoices(configs: PlatformConfigs): PlatformConfigs {
  const CHOICE_KEYS = [
    'sourceChoice',
    'darkSourceChoice',
    'lightSourceChoice',
    'monoSourceChoice',
    'maskableSourceChoice',
    'unplatedSourceChoice',
  ] as const

  let next = configs
  for (const platform of PLATFORMS) {
    const config = next[platform] as unknown as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    for (const key of CHOICE_KEYS) {
      if (key in config && config[key] === 'alternate') patch[key] = 'main'
    }
    if (Object.keys(patch).length) {
      next = updatePlatform(next, platform, patch as Partial<PlatformConfigs[typeof platform]>)
    }
  }
  return next
}
