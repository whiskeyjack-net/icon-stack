import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Notice, SegmentedControl, cn } from '@whiskeyjack-net/design-system'
import { UploadSimple, X, ArrowsIn, ArrowsOut } from '@phosphor-icons/react'
import type { ImageFit, SourceImage } from '@whiskeyjack-net/icon-stack-core'
import { processFile } from '@/lib/process-file'

export interface DedicatedSourceProps {
  /** Section heading, already translated. */
  label: string
  /** Why this platform gets its own artwork, already translated. */
  hint: string
  value: SourceImage | null
  onChange: (source: SourceImage | null) => void
  fit: ImageFit
  onFitChange: (fit: ImageFit) => void
}

/**
 * A per-platform source image, replacing the main artwork for one platform only.
 *
 * Favicons render at 16px in a browser tab and menu-bar icons at 16-22px in a
 * monochrome strip. A mark that survives at 512px routinely turns to mud at
 * those sizes, so both want a *simplified* drawing rather than a scaled one --
 * which is why the core gives `FaviconConfig` and `TrayIconConfig` their own
 * `SourceImage` fields.
 *
 * Those fields existed in the core the whole time and no control ever set them:
 * the capability shipped and stayed unreachable. Empty means "fall back to the
 * main source", which is what the core already does.
 *
 * Deliberately not `SourceSlots`: that component owns the two *session* sources
 * every platform draws from, lives in the generator context, and carries the
 * replace-confirmation flow. This is one field of one platform's config, and
 * replacing it costs nothing worth confirming.
 */
export function DedicatedSource({
  label,
  hint,
  value,
  onChange,
  fit,
  onFitChange,
}: DedicatedSourceProps) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const accept = async (file: File | undefined) => {
    if (!file) return
    try {
      const { source } = await processFile(file)
      setError(null)
      onChange(source)
    } catch (err) {
      // Surfaced beside this control rather than in the page-level error slot,
      // which belongs to generation failures.
      setError(err instanceof Error ? err.message : t('source.readFailed'))
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
          {label}
        </h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
          {hint}
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/svg+xml,.svg"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void accept(file)
        }}
      />

      {error && <Notice tone="error">{error}</Notice>}

      {value ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={value.dataUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg border border-[var(--color-border-light)] object-contain dark:border-[var(--color-border-dark)]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
                {value.fileName}
              </p>
              <p className="text-xs text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                {value.width}&times;{value.height} &middot; {value.type.toUpperCase()}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('platform.dedicatedRemove', { label })}
              title={t('platform.dedicatedRemove', { label })}
              onClick={() => onChange(null)}
            >
              <X size={16} weight="bold" />
            </Button>
          </div>

          {/* Only meaningful for a non-square source; square art fills either way. */}
          {value.width !== value.height && (
            <SegmentedControl
              aria-label={t('source.fit')}
              value={fit}
              onChange={onFitChange}
              options={[
                {
                  value: 'contain' as const,
                  label: t('source.contain'),
                  icon: <ArrowsIn size={14} />,
                },
                {
                  value: 'cover' as const,
                  label: t('source.cover'),
                  icon: <ArrowsOut size={14} />,
                },
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
            'flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed p-3 transition-colors',
            dragging
              ? 'border-[var(--color-accent-500)] bg-[var(--color-accent-50)]'
              : 'border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]',
          )}
        >
          <p className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
            {t('platform.dedicatedUsingMain')}
          </p>
          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
            <UploadSimple size={14} weight="bold" className="mr-1.5" />
            {t('source.choose')}
          </Button>
        </div>
      )}
    </div>
  )
}
