import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Notice,
  ToggleGroup,
  cn,
} from '@whiskeyjack-net/design-system'
import { UploadSimple, Image as ImageIcon, X, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import type { ImageFit } from '@whiskeyjack-net/icon-stack-core'
import { processFile } from '@/lib/process-file'
import { useGenerator, type SourceSlot } from '@/contexts/GeneratorContext'

/**
 * The two source images.
 *
 * `main` is required. `alternate` is optional and exists so dark, monochrome and
 * taskbar variants can use different artwork -- a mark that reads on a light
 * plate often does not read knocked out on a dark one. Platforms pick between
 * them per-variant; see PlatformSettings.
 */
export function SourceSlots() {
  const { t } = useTranslation()
  const { source, alternate, sourceWarning, alternateWarning } = useGenerator()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Slot slot="main" />
      {source ? <Slot slot="alternate" /> : null}
      {(sourceWarning || alternateWarning) && (
        <div className="md:col-span-2 space-y-2">
          {sourceWarning && <Notice tone="warning">{sourceWarning}</Notice>}
          {alternateWarning && <Notice tone="warning">{alternateWarning}</Notice>}
        </div>
      )}
      {!alternate && source && (
        <p className="md:col-span-2 text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
          {t('source.alternateHint')}
        </p>
      )}
    </div>
  )
}

function Slot({ slot }: { slot: SourceSlot }) {
  const { t } = useTranslation()
  const { source, alternate, sourceFit, alternateFit, setSlot, setFit } = useGenerator()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const image = slot === 'main' ? source : alternate
  const fit = slot === 'main' ? sourceFit : alternateFit

  const accept = async (file: File | undefined) => {
    if (!file) return
    try {
      const { source: next, warning } = await processFile(file)
      setSlot(slot, next, warning)
    } catch (err) {
      setSlot(slot, null, err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
            {t(`source.${slot}`)}
          </h3>
          {slot === 'alternate' && (
            <span className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
              {t('source.optional')}
            </span>
          )}
        </div>

        <input
          ref={input}
          type="file"
          data-source-input={slot}
          accept="image/png,image/svg+xml"
          className="sr-only"
          onChange={(e) => void accept(e.target.files?.[0])}
        />

        {image ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={image.dataUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl border border-[var(--color-border-light)] object-contain dark:border-[var(--color-border-dark)]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
                  {image.fileName}
                </p>
                <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                  {image.width}&times;{image.height} &middot; {image.type.toUpperCase()}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('source.remove')}
                title={t('source.remove')}
                onClick={() => setSlot(slot, null)}
              >
                <X size={16} weight="bold" />
              </Button>
            </div>

            {/* Only meaningful for a non-square source; square art fills either way. */}
            {image.width !== image.height && (
              <ToggleGroup
                value={fit}
                onChange={(next: ImageFit) => setFit(slot, next)}
                options={[
                  { value: 'contain' as const, label: t('source.contain'), icon: <ArrowsIn size={18} weight="duotone" /> },
                  { value: 'cover' as const, label: t('source.cover'), icon: <ArrowsOut size={18} weight="duotone" /> },
                ]}
              />
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void accept(e.dataTransfer.files[0])
            }}
            className={cn(
              'rounded-2xl border-2 border-dashed transition-colors',
              dragging
                ? 'border-[var(--color-accent-500)] bg-[var(--color-accent-50)]'
                : 'border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]',
            )}
          >
            <EmptyState
              className="py-10"
              icon={<ImageIcon size={28} weight="duotone" />}
              title={t(`source.${slot}Title`)}
              subtitle={t(`source.${slot}Subtitle`)}
              action={
                <Button variant={slot === 'main' ? 'accent' : 'outline'} onClick={() => input.current?.click()}>
                  <UploadSimple size={16} weight="bold" className="mr-1.5" />
                  {t('source.choose')}
                </Button>
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
