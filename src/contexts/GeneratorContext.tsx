import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
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
import { processFile } from '@/lib/process-file'

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
  /**
   * The single entry point for a picked or dropped File, whichever control
   * produced it. Replacing an existing MAIN source parks the file and raises
   * `replacePending` instead of applying it -- every per-platform setting is
   * tuned against that image, so a mis-drop would silently invalidate the whole
   * session's work.
   */
  requestFile: (slot: SourceSlot, file: File | undefined) => Promise<void>
  /** The file waiting on a replace confirmation, or null. */
  replacePending: File | null
  confirmReplace: () => Promise<void>
  cancelReplace: () => void
  /**
   * The one hidden file input for the MAIN source, owned by the Layout so the
   * toolbar can reach it from any tab -- on a platform tab the source cards are
   * not mounted, so an input living beside them would not exist to click.
   */
  fileInputRef: RefObject<HTMLInputElement>
  /** Opens the main-source file picker. */
  triggerUpload: () => void
  setSelected: (platform: Platform) => void
  setFit: (slot: SourceSlot, fit: ImageFit) => void
  patchPlatform: <K extends Platform>(platform: K, patch: Partial<PlatformConfigs[K]>) => void
  togglePlatform: (platform: Platform) => void
  /** Set the whole enabled set at once, for a multi-select control. */
  setEnabledPlatforms: (enabled: Platform[]) => void
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
  const [replacePending, setReplacePending] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const acceptFile = useCallback(
    async (slot: SourceSlot, file: File) => {
      try {
        const { source: next, warning } = await processFile(file)
        setSlot(slot, next, warning)
      } catch (err) {
        // A rejected file leaves the slot empty rather than half-set, and the
        // reason rides in the slot's own warning so it appears beside the card
        // that failed.
        setSlot(slot, null, err instanceof Error ? err.message : 'Could not read that file.')
      }
    },
    [setSlot],
  )

  const requestFile = useCallback(
    async (slot: SourceSlot, file: File | undefined) => {
      if (!file) return
      if (slot === 'main' && source) {
        setReplacePending(file)
        return
      }
      await acceptFile(slot, file)
    },
    [source, acceptFile],
  )

  const confirmReplace = useCallback(async () => {
    const file = replacePending
    setReplacePending(null)
    if (file) await acceptFile('main', file)
  }, [replacePending, acceptFile])

  const cancelReplace = useCallback(() => setReplacePending(null), [])

  const triggerUpload = useCallback(() => fileInputRef.current?.click(), [])

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

  // A multi-select control hands back the whole set rather than a delta, so this
  // reconciles every platform's `enabled` against it in one pass.
  const setEnabledPlatforms = useCallback((enabled: Platform[]) => {
    const wanted = new Set(enabled)
    setPlatforms((prev) => {
      let next = prev
      for (const platform of PLATFORMS) {
        const should = wanted.has(platform)
        if (next[platform].enabled !== should) {
          next = updatePlatform(next, platform, { enabled: should })
        }
      }
      return next
    })
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
      requestFile,
      replacePending,
      confirmReplace,
      cancelReplace,
      fileInputRef,
      triggerUpload,
      setSelected,
      setFit,
      patchPlatform,
      togglePlatform,
      setEnabledPlatforms,
      generate,
      render,
    }),
    [
      requestFile,
      replacePending,
      confirmReplace,
      cancelReplace,
      triggerUpload,
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
      setEnabledPlatforms,
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
