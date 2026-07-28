import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  ButtonRow,
  Card,
  CardContent,
  EmptyState,
  Notice,
  ProgressBar,
  TabBar,
  cn,
  useSwipeNavigation,
} from '@whiskeyjack-net/design-system'
import {
  UploadSimple,
  DownloadSimple,
  Image as ImageIcon,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import {
  generateIcons,
  createDefaultPlatforms,
  PLATFORM_LABELS,
  type Platform,
  type SourceImage,
  type PlatformConfigs,
} from '@whiskeyjack-net/icon-stack-core'
import { processFile } from '@/lib/process-file'
import { PlatformSettings } from '@/components/PlatformSettings'

/** Platforms exposed in the UI, in the order the tabs present them. */
const PLATFORMS: Platform[] = [
  'favicon',
  'pwa',
  'windows',
  'windowsStore',
  'linux',
  'android',
  'macos',
  'ios',
  'appleTouchIcon',
  'trayIcon',
]

export function Home() {
  const { t } = useTranslation()
  const fileInput = useRef<HTMLInputElement>(null)

  const [source, setSource] = useState<SourceImage | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Platform>('favicon')
  const [platforms, setPlatforms] = useState(createDefaultPlatforms)

  const activeIndex = PLATFORMS.indexOf(selected)
  // The design system's rule: a TabBar is always paired with swipe navigation,
  // so the content moves the same way the tabs do.
  const { swipeOffset, isAnimating, handleTouchStart, handleTouchMove, handleTouchEnd } =
    useSwipeNavigation({
      count: PLATFORMS.length,
      activeIndex,
      onNavigate: (index) => setSelected(PLATFORMS[index]),
    })

  const patchPlatform = (patch: Partial<PlatformConfigs[Platform]>) =>
    setPlatforms((prev) => ({ ...prev, [selected]: { ...prev[selected], ...patch } }))
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const accept = useCallback(async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const { source: next, warning: nextWarning } = await processFile(file)
      setSource(next)
      setWarning(nextWarning)
    } catch (err) {
      setSource(null)
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragging(false)
      void accept(event.dataTransfer.files[0])
    },
    [accept],
  )

  const generate = async () => {
    if (!source) return
    setBusy(true)
    setError(null)
    setProgress(0)
    try {
      // Generate only the platform on screen, from its edited config.
      //
      // Object.assign rather than `selection[key] = {...}`: writing to an
      // indexed property whose key is a union requires the value to satisfy the
      // INTERSECTION of every config type, which no single config does. Mutating
      // the existing object sidesteps that without a cast.
      const selection = createDefaultPlatforms()
      for (const key of Object.keys(selection) as Platform[]) {
        Object.assign(selection[key], platforms[key], { enabled: key === selected })
      }

      const zip = await generateIcons({
        source,
        alternate: null,
        platforms: selection,
        sourceFit: 'contain',
        alternateFit: 'contain',
        faviconFit: 'contain',
        trayFit: 'contain',
        onProgress: setProgress,
      })

      const url = URL.createObjectURL(new Blob([zip as unknown as BlobPart], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `icon-stack-${selected}-${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.')
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-6">
      <header className="pt-4">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
          {t('home.title')}
        </h1>
        <p className="mt-1 text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
          {t('home.subtitle')}
        </p>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/svg+xml"
        className="sr-only"
        onChange={(e) => void accept(e.target.files?.[0])}
      />

      {source ? (
        <>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center gap-4">
              <img
                src={source.dataUrl}
                alt=""
                className="h-16 w-16 rounded-xl border border-[var(--color-border-light)] object-contain dark:border-[var(--color-border-dark)]"
              />
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
                  {source.fileName}
                </p>
                <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                  {source.width}&times;{source.height} &middot; {source.type.toUpperCase()}
                </p>
              </div>
            </div>

            {warning && <Notice tone="warning">{warning}</Notice>}

            {busy && <ProgressBar value={progress / 100} label={t('home.generating')} />}

            <ButtonRow>
              <Button
                variant="outline"
                onClick={() => {
                  setSource(null)
                  setWarning(null)
                }}
              >
                <ArrowCounterClockwise size={16} weight="bold" className="mr-1.5" />
                {t('home.change')}
              </Button>
              <Button variant="accent" onClick={() => void generate()} disabled={busy}>
                <DownloadSimple size={16} weight="bold" className="mr-1.5" />
                {busy ? t('home.generating') : t('home.generate')}
              </Button>
            </ButtonRow>
          </CardContent>
        </Card>

        <TabBar
          items={PLATFORMS.map((id) => ({ id, label: PLATFORM_LABELS[id] }))}
          activeId={selected}
          onSelect={(id) => setSelected(id as Platform)}
        />

        {/* Viewport-sized wrapper: a content-height one silently swallows
            swipes below short content. */}
        <div
          className="min-h-[calc(100dvh-20rem)] touch-pan-y md:min-h-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            style={{ transform: `translateX(${swipeOffset}px)` }}
            className={cn(isAnimating && 'transition-transform duration-200')}
          >
            <PlatformSettings
              platform={selected}
              config={platforms[selected]}
              onChange={patchPlatform}
            />
          </div>
        </div>
        </>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'rounded-2xl border-2 border-dashed p-2 transition-colors',
            dragging
              ? 'border-[var(--color-accent-500)] bg-[var(--color-accent-50)]'
              : 'border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]',
          )}
        >
          <EmptyState
            icon={<ImageIcon size={32} weight="duotone" />}
            title={t('home.dropTitle')}
            subtitle={t('home.dropSubtitle')}
            action={
              <Button variant="accent" onClick={() => fileInput.current?.click()}>
                <UploadSimple size={16} weight="bold" className="mr-1.5" />
                {t('home.choose')}
              </Button>
            }
          />
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
