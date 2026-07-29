import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, Notice, ToggleGroup } from '@whiskeyjack-net/design-system'
import { Shuffle, Watch } from '@phosphor-icons/react'
import {
  PLATFORM_LABELS,
  fillToCss,
  type BackgroundFill,
  type Platform,
} from '@whiskeyjack-net/icon-stack-core'
import { useGenerator } from '@/contexts/GeneratorContext'
import {
  LEGIBILITY_MAX,
  groupByVariant,
  sizesOf,
  type IconVariant,
  type RenderedIcon,
} from '@/lib/icon-variants'
import { osMaskFor } from '@/lib/os-mask'
import {
  APPLE_APPEARANCES,
  TINTED_PLATE,
  appleLayerFor,
  type AppleAppearance,
} from '@/lib/apple-appearance'
import { DEFAULT_BACKDROP, backdropStyle, randomBackdrop } from '@/lib/backdrop'

/**
 * Widest the large preview is drawn. A 1024px render at 1:1 would be taller than
 * the rail it lives in, so the hero is scaled while the caption keeps naming the
 * real pixel size.
 */
const HERO_MAX = 208

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
 *
 * Two things it shows, because they answer different questions:
 *
 *   HERO   the largest render, carrying the shape the OS gives it. This is where
 *          you see artwork run into a corner and get sliced off.
 *   ROW    every size at or below 128, at 1:1. This is where you see a mark stop
 *          being readable.
 *
 * Both are the real exported bytes at their own resolution, so a baked corner
 * radius needs no simulating -- it is already in the pixels. Only the shape the
 * OS imposes at display time is drawn on top, and the caption says so.
 */
export function SizePreview({ platform, title }: SizePreviewProps) {
  const { source, platforms, alternate, render } = useGenerator()
  const { t, i18n } = useTranslation()
  const [variants, setVariants] = useState<Map<IconVariant, RenderedIcon[]>>(new Map())
  const [active, setActive] = useState<IconVariant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [appearance, setAppearance] = useState<AppleAppearance>('light')
  const [watch, setWatch] = useState(false)
  const [backdrop, setBackdrop] = useState(DEFAULT_BACKDROP)
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
  const picked = active && variants.has(active) ? active : (available[0] ?? null)

  // Apple ships a transparent foreground and declares its plate in icon.json, so
  // the appearance picker REPLACES the variant picker here: the exported layers
  // are the appearances, and two controls would be two names for one choice.
  const isApple = platform === 'apple'
  const appleConfig = platforms.apple as unknown as {
    bgFill: BackgroundFill
    bgFillDark: BackgroundFill
  }
  const appleLayer = isApple ? appleLayerFor(appearance, available) : null
  const shown = appleLayer?.variant ?? picked

  // Object URLs are derived from the bytes and revoked when they change, so a
  // long session does not leak every preview it made.
  //
  // Every distinct size in the variant gets one URL. The row below shows the
  // small end at 1:1 and the hero shows the largest, so both read from this map
  // rather than building blobs twice for the same bytes.
  const rendered = useMemo(() => {
    if (!shown) return []
    const icons = variants.get(shown) ?? []
    return sizesOf(icons).flatMap((size) => {
      const match = icons.find((i) => i.size === size)
      if (!match) return []
      const blob = new Blob([match.bytes as unknown as BlobPart], { type: 'image/png' })
      return [{ size, url: URL.createObjectURL(blob) }]
    })
  }, [variants, shown])

  useEffect(() => () => rendered.forEach((p) => URL.revokeObjectURL(p.url)), [rendered])

  const legible = rendered.filter((r) => r.size <= LEGIBILITY_MAX)
  const largest = rendered[rendered.length - 1]

  // Only worth a hero when it shows something the 1:1 row cannot. A favicon tops
  // out at 32 and a tray icon at 48, so for those the row already IS the icon.
  const hero = largest && largest.size > LEGIBILITY_MAX ? largest : null

  const mask = shown ? osMaskFor(platform, shown) : { radius: null }
  // An Apple Watch icon is circular whatever the desktop does with the same file.
  const radius = isApple && watch ? '50%' : mask.radius
  const maskStyle = radius ? { borderRadius: radius } : undefined

  // The plate the OS puts behind the artwork, which this export never bakes.
  const applePlate = !isApple
    ? null
    : appearance === 'tinted'
      ? TINTED_PLATE
      : fillToCss(appearance === 'dark' ? appleConfig.bgFillDark : appleConfig.bgFill)

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-4 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
          {title ?? t('preview.title')}
        </h3>

        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <div className="space-y-4">
            {isApple ? (
              <div className="space-y-3">
                <ToggleGroup
                  className="!grid-cols-3"
                  options={APPLE_APPEARANCES.map((a) => ({
                    value: a,
                    label: t(`preview.appearance.${a}`),
                  }))}
                  value={appearance}
                  onChange={setAppearance}
                />
                <Button
                  variant={watch ? 'accent' : 'outline'}
                  size="sm"
                  aria-pressed={watch}
                  onClick={() => setWatch(!watch)}
                >
                  <Watch size={16} weight={watch ? 'fill' : 'regular'} className="mr-1.5" />
                  {t('preview.watch')}
                </Button>
              </div>
            ) : (
              /* Only worth showing when there is a choice: most platforms export
                 one variant, and a one-option segmented control is noise. */
              available.length > 1 && (
                <ToggleGroup
                  className="!grid-cols-2 sm:!grid-cols-4"
                  options={available.map((v) => ({ value: v, label: t(`preview.variant.${v}`) }))}
                  value={shown as IconVariant}
                  onChange={setActive}
                />
              )
            )}

            <div className="space-y-5 transition-opacity" style={{ opacity: pending ? 0.5 : 1 }}>
              {hero && (
                <figure className="flex flex-col items-center gap-2">
                  {/* An icon is judged against a wallpaper, never against a card:
                      a pale plate or a white outer edge vanishes on a real
                      desktop and looks fine here. Re-roll to check. */}
                  <div
                    className="flex w-full items-center justify-center rounded-xl p-6"
                    style={backdropStyle(backdrop)}
                  >
                    <div
                      style={{
                        ...maskStyle,
                        // Apple declares its plate rather than baking it, so the
                        // preview supplies the one the OS would composite.
                        ...(applePlate ? { background: applePlate } : null),
                        width: Math.min(hero.size, HERO_MAX),
                        height: Math.min(hero.size, HERO_MAX),
                      }}
                      className="overflow-hidden"
                    >
                      <img
                        src={hero.url}
                        width={Math.min(hero.size, HERO_MAX)}
                        height={Math.min(hero.size, HERO_MAX)}
                        alt={t('preview.alt', { size: hero.size })}
                        // Tinted mode renders the layer as a white silhouette,
                        // which is what macOS does with the monochrome layer.
                        style={
                          appleLayer?.monochrome
                            ? { filter: 'brightness(0) invert(1)' }
                            : undefined
                        }
                        className="[image-rendering:auto]"
                      />
                    </div>
                  </div>

                  <figcaption className="flex items-center gap-2 text-xs tabular-nums text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                    <span>
                      {hero.size}px
                      {hero.size > HERO_MAX && (
                        <span className="ms-1 opacity-70">
                          {t('preview.shownAt', { size: HERO_MAX })}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBackdrop(randomBackdrop())}
                      aria-label={t('preview.shuffleBackdrop')}
                      title={t('preview.shuffleBackdrop')}
                      className="wj-focus-ring rounded p-1 hover:text-[var(--color-text-primary-light)] dark:hover:text-[var(--color-text-primary-dark)]"
                    >
                      <Shuffle size={14} weight="bold" />
                    </button>
                  </figcaption>
                </figure>
              )}

              <div className="flex flex-wrap items-end gap-6">
                {legible.map(({ size, url }) => (
                  <figure key={size} className="flex flex-col items-center gap-2">
                    <img
                      src={url}
                      width={size}
                      height={size}
                      alt={t('preview.alt', { size })}
                      style={maskStyle}
                      className="[image-rendering:auto]"
                    />
                    <figcaption className="text-xs tabular-nums text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                      {size}px
                    </figcaption>
                  </figure>
                ))}
              </div>

              {!rendered.length && (
                <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                  {t('preview.none')}
                </p>
              )}

              {/* Said out loud because the exported PNG stays square: without
                  this, a rounded preview reads as a claim about the file. */}
              {mask.radius && (
                <p className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                  {t('preview.maskApplied', { platform: PLATFORM_LABELS[platform] })}
                </p>
              )}

              {/* What the OS does that the file cannot show. Only the platforms
                  with something non-obvious to say carry one. */}
              {i18n.exists(`preview.note.${platform}`) && (
                <p className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                  {t(`preview.note.${platform}`)}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
