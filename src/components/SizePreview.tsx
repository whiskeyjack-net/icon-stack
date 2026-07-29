import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, Notice, ToggleGroup } from '@whiskeyjack-net/design-system'
import type { Platform } from '@whiskeyjack-net/icon-stack-core'
import { useGenerator } from '@/contexts/GeneratorContext'
import {
  groupByVariant,
  pickForSize,
  type IconVariant,
  type RenderedIcon,
} from '@/lib/icon-variants'

/** Sizes worth eyeballing: the ones where a mark actually breaks down. */
const PREVIEW_SIZES = [16, 32, 64, 128] as const

export interface SizePreviewProps {
  platform: Platform
  /**
   * Card heading. Defaults to a plain "Preview"; the rail passes the platform
   * name instead, because on the source tab it stacks one card per enabled
   * platform and identical headings would make them indistinguishable.
   */
  title?: string
}

/**
 * Renders the selected platform through the real pipeline and shows the result at
 * the sizes where legibility fails, rather than scaling one large render down in
 * CSS -- a 16px icon looks nothing like a 512px one shrunk by the browser, which
 * is the whole reason the pipeline resamples per size.
 *
 * A platform exports several *different* icons, not one at several sizes, so the
 * renders are grouped into variants (plain, maskable, dark, monochrome, Android's
 * adaptive layers) and one is shown at a time. Before that, the preview picked
 * whichever same-size render came first out of the file map -- so a PWA preview
 * could be the maskable icon without saying so, and an Android preview could be
 * the bare background plate.
 */
export function SizePreview({ platform, title }: SizePreviewProps) {
  const { source, platforms, alternate, render } = useGenerator()
  const { t } = useTranslation()
  const [variants, setVariants] = useState<Map<IconVariant, RenderedIcon[]>>(new Map())
  const [active, setActive] = useState<IconVariant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const runRef = useRef(0)

  useEffect(() => {
    // Settings change on every slider tick; debounce so the pipeline is not
    // re-run per pixel of drag.
    const run = ++runRef.current
    setPending(true)
    const timer = setTimeout(async () => {
      try {
        const grouped = groupByVariant(await render(platform))
        if (run !== runRef.current) return // a newer run superseded this one
        setVariants(grouped)
        setError(null)
      } catch (err) {
        if (run !== runRef.current) return
        setError(err instanceof Error ? err.message : 'Preview failed.')
      } finally {
        if (run === runRef.current) setPending(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [platform, platforms, source, alternate, render])

  const available = [...variants.keys()]

  // Hold the chosen variant across re-renders, but fall back when it disappears
  // -- switching a platform's monochrome layer off should not leave a blank card.
  const shown = active && variants.has(active) ? active : (available[0] ?? null)

  // Object URLs are derived from the bytes and revoked when they change, so a
  // long session does not leak every preview it made.
  const previews = useMemo(() => {
    if (!shown) return []
    const icons = variants.get(shown) ?? []
    return PREVIEW_SIZES.flatMap((size) => {
      const match = pickForSize(icons, size)
      if (!match) return []
      const blob = new Blob([match.bytes as unknown as BlobPart], { type: 'image/png' })
      return [{ size, url: URL.createObjectURL(blob), source: match.size }]
    })
  }, [variants, shown])

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
          {title ?? t('preview.title')}
        </h3>

        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <div className="space-y-4">
            {/* Only worth showing when there is a choice: most platforms export
                one variant, and a one-option segmented control is noise. */}
            {available.length > 1 && (
              <ToggleGroup
                className="!grid-cols-2 sm:!grid-cols-4"
                options={available.map((v) => ({ value: v, label: t(`preview.variant.${v}`) }))}
                value={shown as IconVariant}
                onChange={setActive}
              />
            )}

            <div
              className="flex flex-wrap items-end gap-6 transition-opacity"
              style={{ opacity: pending ? 0.5 : 1 }}
            >
              {previews.map(({ size, url, source: renderedAt }) => (
                <figure key={size} className="flex flex-col items-center gap-2">
                  <img
                    src={url}
                    width={size}
                    height={size}
                    alt={t('preview.alt', { size })}
                    className="[image-rendering:auto]"
                  />
                  <figcaption className="text-xs tabular-nums text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                    {size}px
                    {/* Named when the shown pixels are a downscale of a bigger
                        render, so a soft edge is explained rather than suspected. */}
                    {renderedAt !== size && (
                      <span className="ms-1 opacity-70">{t('preview.from', { size: renderedAt })}</span>
                    )}
                  </figcaption>
                </figure>
              ))}
              {!previews.length && (
                <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                  {t('preview.none')}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
