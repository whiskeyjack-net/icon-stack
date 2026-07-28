import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, Notice } from '@whiskeyjack-net/design-system'
import type { Platform } from '@whiskeyjack-net/icon-stack-core'
import { useGenerator } from '@/contexts/GeneratorContext'

/** Sizes worth eyeballing: the ones where a mark actually breaks down. */
const PREVIEW_SIZES = [16, 32, 64, 128] as const

export interface SizePreviewProps {
  platform: Platform
}

/**
 * Renders the selected platform through the real pipeline and shows the result
 * at the sizes where legibility fails, rather than scaling one large render
 * down in CSS -- a 16px icon looks nothing like a 512px one shrunk by the
 * browser, which is the whole reason the pipeline resamples per size.
 */
export function SizePreview({ platform }: SizePreviewProps) {
  const { source, platforms, alternate, render } = useGenerator()
  const { t } = useTranslation()
  const [previews, setPreviews] = useState<{ size: number; url: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const urlsRef = useRef<string[]>([])
  const runRef = useRef(0)

  useEffect(() => {
    // Settings change on every slider tick; debounce so the pipeline is not
    // re-run per pixel of drag.
    const run = ++runRef.current
    setPending(true)
    const timer = setTimeout(async () => {
      try {
        const files = await render(platform)
        if (run !== runRef.current) return // a newer run superseded this one
        const pngs = Object.entries(files)
          .filter(([name]) => name.endsWith('.png'))
          .map(([name, bytes]) => ({ name, bytes, size: pngSize(bytes) }))
          .filter((f) => f.size > 0)

        // flatMap rather than map+filter: `as const` makes the sizes a literal
        // union, which a `number` type predicate cannot narrow to.
        const next = PREVIEW_SIZES.flatMap<{ size: number; url: string }>((size) => {
          // The closest render at or above this size, so a real render is
          // downscaled rather than a smaller one upscaled.
          const match =
            pngs.filter((f) => f.size >= size).sort((a, b) => a.size - b.size)[0] ??
            pngs.slice().sort((a, b) => b.size - a.size)[0]
          if (!match) return []
          const blob = new Blob([match.bytes as unknown as BlobPart], { type: 'image/png' })
          return [{ size, url: URL.createObjectURL(blob) }]
        })

        urlsRef.current.forEach(URL.revokeObjectURL)
        urlsRef.current = next.map((p) => p.url)
        setPreviews(next)
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

  // Revoke on unmount, so a long session does not leak every preview it made.
  useEffect(() => () => urlsRef.current.forEach(URL.revokeObjectURL), [])

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
          {t('preview.title')}
        </h3>

        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <div
            className="flex flex-wrap items-end gap-6 transition-opacity"
            style={{ opacity: pending ? 0.5 : 1 }}
          >
            {previews.map(({ size, url }) => (
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
                </figcaption>
              </figure>
            ))}
            {!previews.length && (
              <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                {t('preview.none')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Width from a PNG's IHDR, which always sits at a fixed offset. */
function pngSize(bytes: Uint8Array): number {
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return 0
  return (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
}
