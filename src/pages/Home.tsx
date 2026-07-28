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
  ToggleGroup,
  cn,
} from '@whiskeyjack-net/design-system'
import { DownloadSimple, Image as ImageIcon, ArrowCounterClockwise } from '@phosphor-icons/react'
import {
  generateIcons,
  createDefaultPlatforms,
  PLATFORM_LABELS,
  type Platform,
  type SourceImage,
} from '@whiskeyjack-net/icon-stack-core'
import { processFile } from '@/lib/process-file'

/** The subset Stage A ships. The rest land in Stage B. */
const STAGE_A_PLATFORMS: Platform[] = ['favicon', 'pwa', 'linux', 'windows']

export function Home() {
  const { t } = useTranslation()
  const fileInput = useRef<HTMLInputElement>(null)

  const [source, setSource] = useState<SourceImage | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Platform>('favicon')
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
      const platforms = createDefaultPlatforms()
      for (const key of Object.keys(platforms) as Platform[]) {
        platforms[key].enabled = key === selected
      }

      const zip = await generateIcons({
        source,
        alternate: null,
        platforms,
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

            <div>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                {t('home.platform')}
              </h2>
              <ToggleGroup
                value={selected}
                onChange={setSelected}
                options={STAGE_A_PLATFORMS.map((id) => ({ value: id, label: PLATFORM_LABELS[id] }))}
              />
            </div>

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
          {/* FINDING: EmptyState's CTA is `ctaLabel` + `onCta`, a label and a
              handler rather than a ReactNode slot -- so the button cannot carry
              an icon or use a non-accent variant. See FINDINGS.md. */}
          <EmptyState
            icon={<ImageIcon size={32} weight="duotone" />}
            title={t('home.dropTitle')}
            subtitle={t('home.dropSubtitle')}
            ctaLabel={t('home.choose')}
            onCta={() => fileInput.current?.click()}
          />
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
