import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, Notice, SegmentedControl, cn } from '@whiskeyjack-net/design-system'
import {
  BoundingBox,
  Circle,
  Drop,
  ImageSquare,
  Moon,
  Shuffle,
  Sun,
  Watch,
} from '@phosphor-icons/react'
import {
  PLATFORM_LABELS,
  WINDOWS_STORE_UNPLATED_SIZES,
  fillToCss,
  type BackgroundFill,
  type Platform,
} from '@whiskeyjack-net/icon-stack-core'
import { useGenerator } from '@/contexts/GeneratorContext'
import { groupByVariant, sizesOf, type IconVariant, type RenderedIcon } from '@/lib/icon-variants'
import { osMaskFor } from '@/lib/os-mask'
import {
  APPLE_APPEARANCES,
  TINTED_PLATE,
  appleLayerFor,
  type AppleAppearance,
} from '@/lib/apple-appearance'
import { DEFAULT_BACKDROP, backdropStyle, randomBackdrop } from '@/lib/backdrop'

/** Largest the preview is drawn. A 1024px icon at 1:1 is taller than its rail. */
const DISPLAY_MAX = 256

/**
 * At or below this, a browser's smooth scaling flatters the icon and hides the
 * thing you are looking for. `pixelated` shows the pixels the pipeline resampled.
 */
const PIXELATED_UPTO = 32

/**
 * Layers, not icons -- **on Android**.
 *
 * A launcher composites Android's adaptive layers and masks the RESULT, so a
 * foreground on its own is a state no device renders. Offering them in a picker
 * put two non-answers beside the real one; the finalized `ic_launcher` is what
 * Android shows, and that is what this previews.
 *
 * The platform qualifier is load-bearing. `foreground` is a layer on Android and
 * the ARTWORK on Apple -- `AppIcon.icon/Assets/foreground.png` is the only raster
 * an Apple export contains, with the plate declared in `icon.json` beside it.
 * Filtering the variant name globally left Apple with nothing to preview at all.
 */
const ANDROID_LAYERS: IconVariant[] = ['foreground', 'background']

/** Platforms whose exported file already carries a drawn corner radius. */
const BAKES_A_CORNER: Platform[] = ['windows', 'linux', 'favicon']

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
 * One icon, at one size, shaped the way the platform will shape it.
 *
 * The controls pick WHICH icon -- per platform: an Apple appearance, a light or
 * dark variant, monochrome, maskable -- and at WHAT size. The box below shows
 * that one, on a wallpaper, masked.
 *
 * That structure is the monorepo build's and it is the right one. Rendering every
 * size at once answers a question nobody asked while burying the one they did,
 * and it cost the size picker, the pixelated small end, and any notion of a
 * platform-shaped choice.
 *
 * The pixels are the real exported bytes. A platform export is several
 * *different* icons rather than one at several sizes, so renders are grouped by
 * variant and the toggles select among them -- which is also what stops the
 * preview showing a maskable icon while presenting itself as the plain one.
 *
 * Two things it therefore never simulates: a baked corner radius is already in
 * the pixels, and so is a squircle. Only what the OS adds at display time goes on
 * top -- its mask, and Apple's declared plate.
 */
export function SizePreview({ platform, title }: SizePreviewProps) {
  const { source, platforms, alternate, render } = useGenerator()
  const { t } = useTranslation()
  const [variants, setVariants] = useState<Map<IconVariant, RenderedIcon[]>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [size, setSize] = useState<number | null>(null)
  const [appearance, setAppearance] = useState<AppleAppearance>('light')
  const [watch, setWatch] = useState(false)
  const [dark, setDark] = useState(false)
  const [mono, setMono] = useState(false)
  const [maskable, setMaskable] = useState(false)
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

  const available = [...variants.keys()].filter(
    (v) => platform !== 'android' || !ANDROID_LAYERS.includes(v),
  )
  const has = (v: IconVariant) => available.includes(v)
  const config = platforms[platform] as unknown as Record<string, unknown>

  const isApple = platform === 'apple'
  const hasDark = has('dark')
  const hasMono = has('mono') && !isApple
  const hasMaskable = has('maskable')

  /**
   * Which exported variant the current toggles select.
   *
   * Resolved per platform rather than through one generic picker, because the
   * question is platform-shaped: an Apple appearance is not the same kind of
   * choice as "regular or maskable", even though both land on a variant.
   */
  const appleLayer = isApple ? appleLayerFor(appearance, available) : null
  let shown: IconVariant | null
  if (appleLayer) shown = appleLayer.variant
  else if (hasMono && mono) shown = 'mono'
  else if (hasMaskable && maskable) shown = 'maskable'
  else if (hasDark && dark) shown = 'dark'
  else if (hasDark) shown = has('light') ? 'light' : 'regular'
  else shown = available[0] ?? null

  // Memoised because the object URL below depends on it, and a fresh array every
  // render would rebuild the blob on every render with it.
  const icons = useMemo(() => (shown ? (variants.get(shown) ?? []) : []), [variants, shown])
  const sizes = sizesOf(icons)

  // Hold the chosen size across variant switches, and fall back to the largest
  // when this variant does not carry it: tray tops out at 48 where windows
  // reaches 256, so a stale selection would otherwise empty the box.
  const selected = size !== null && sizes.includes(size) ? size : (sizes[sizes.length - 1] ?? null)

  const url = useMemo(() => {
    const match = icons.find((i) => i.size === selected)
    if (!match) return null
    return URL.createObjectURL(
      new Blob([match.bytes as unknown as BlobPart], { type: 'image/png' }),
    )
  }, [icons, selected])

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  // --- Shape -----------------------------------------------------------------
  const mask = shown ? osMaskFor(platform, shown) : { radius: null }
  const smoothing = Number(config.cornerSmoothing ?? 0)
  const bakesACorner =
    BAKES_A_CORNER.includes(platform) &&
    !config.bgTransparent &&
    Number(config.cornerRadius ?? 0) > 0

  // An Apple Watch icon is circular whatever the desktop does with the same file.
  // Otherwise: only what the OS applies. A baked corner is in the pixels already,
  // and a baked squircle is a superellipse that CSS `border-radius` cannot
  // express -- rounding on top of either clips the shape the pipeline just drew.
  const radius = isApple && watch ? '50%' : bakesACorner && smoothing > 0 ? null : mask.radius

  const plate = !isApple
    ? null
    : appearance === 'tinted'
      ? TINTED_PLATE
      : fillToCss((appearance === 'dark' ? config.bgFillDark : config.bgFill) as BackgroundFill)

  const display = Math.min(selected ?? 0, DISPLAY_MAX)
  const label = PLATFORM_LABELS[platform]
  const unplated = selected !== null && WINDOWS_STORE_UNPLATED_SIZES.includes(selected)

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-4 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
          {title ?? t('preview.title')}
        </h3>

        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : selected === null ? (
          <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {t('preview.none')}
          </p>
        ) : (
          <div className="space-y-3 transition-opacity" style={{ opacity: pending ? 0.6 : 1 }}>
            {/* --- Which size, and which icon -------------------------------- */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 flex-wrap gap-1.5">
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === selected}
                    onClick={() => setSize(s)}
                    className={cn(
                      'wj-focus-ring rounded-lg px-2.5 py-1 font-mono text-xs font-medium transition-colors',
                      s === selected
                        ? 'bg-[var(--color-neutral-700)] text-white dark:bg-[var(--color-neutral-300)] dark:text-[var(--color-neutral-900)]'
                        : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary-light)] hover:bg-[var(--color-warm-100)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-text-secondary-dark)] dark:hover:bg-[var(--color-neutral-800)]',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {isApple && (
                <>
                  <SegmentedControl
                    aria-label={t('preview.appearanceLabel')}
                    value={appearance}
                    onChange={setAppearance}
                    options={APPLE_APPEARANCES.map((a) => ({
                      value: a,
                      label: t(`preview.appearance.${a}`),
                      icon: APPEARANCE_ICON[a],
                    }))}
                  />
                  <TogglePill
                    active={watch}
                    onClick={() => setWatch(!watch)}
                    icon={<Watch size={12} weight={watch ? 'fill' : 'bold'} />}
                    label={t('preview.watch')}
                  />
                </>
              )}

              {/* Icon-only: a sun and a moon ARE the vocabulary, and spelling
                  them out costs more room than it earns. */}
              {!isApple && hasDark && (
                <SegmentedControl
                  aria-label={t('preview.appearanceLabel')}
                  hideLabels
                  value={dark ? 'dark' : 'light'}
                  onChange={(v) => setDark(v === 'dark')}
                  options={[
                    {
                      value: 'light',
                      label: t('preview.appearance.light'),
                      icon: <Sun size={14} weight="bold" />,
                    },
                    {
                      value: 'dark',
                      label: t('preview.appearance.dark'),
                      icon: <Moon size={14} weight="bold" />,
                    },
                  ]}
                />
              )}

              {hasMono && (
                <TogglePill
                  active={mono}
                  onClick={() => setMono(!mono)}
                  icon={<Circle size={12} weight={mono ? 'fill' : 'bold'} />}
                  label={t('preview.variant.mono')}
                />
              )}

              {hasMaskable && (
                <SegmentedControl
                  aria-label={t('preview.variantLabel')}
                  value={maskable ? 'maskable' : 'regular'}
                  onChange={(v) => setMaskable(v === 'maskable')}
                  options={[
                    {
                      value: 'regular',
                      label: t('preview.variant.regular'),
                      icon: <ImageSquare size={12} weight="bold" />,
                    },
                    {
                      value: 'maskable',
                      label: t('preview.variant.maskable'),
                      icon: <BoundingBox size={12} weight="bold" />,
                    },
                  ]}
                />
              )}
            </div>

            {/* --- The icon, on a wallpaper ---------------------------------- */}
            <div
              className="relative flex items-center justify-center rounded-xl border border-[var(--color-border-light)] p-6 dark:border-[var(--color-border-dark)]"
              style={backdropStyle(backdrop)}
            >
              <button
                type="button"
                onClick={() => setBackdrop(randomBackdrop())}
                aria-label={t('preview.shuffleBackdrop')}
                title={t('preview.shuffleBackdrop')}
                className="wj-focus-ring absolute end-2 top-2 rounded-lg bg-white/40 p-1.5 transition-colors hover:bg-white/60 dark:bg-black/20 dark:hover:bg-black/40"
              >
                <Shuffle
                  size={14}
                  weight="bold"
                  className="text-[var(--color-neutral-700)] dark:text-[var(--color-neutral-200)]"
                />
              </button>

              <div
                className="overflow-hidden"
                style={{
                  width: display,
                  height: display,
                  ...(radius ? { borderRadius: radius } : null),
                  // Apple declares its plate in icon.json rather than baking it,
                  // so the preview supplies what the OS would composite.
                  ...(plate ? { background: plate } : null),
                }}
              >
                {url && (
                  <img
                    src={url}
                    width={display}
                    height={display}
                    alt={t('preview.canvasAriaLabel', { size: selected, platform: label })}
                    style={{
                      imageRendering: selected <= PIXELATED_UPTO ? 'pixelated' : 'auto',
                      ...(appleLayer?.monochrome ? { filter: 'brightness(0) invert(1)' } : null),
                    }}
                  />
                )}
              </div>
            </div>

            {/* --- What you are looking at ----------------------------------- */}
            <p className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
              {t('preview.captionBase', { size: selected, platform: label })}
              {isApple &&
                t(watch ? 'preview.appleModeWatchSuffix' : 'preview.appleModeSuffix', {
                  mode: t(`preview.appearance.${appearance}`).toLowerCase(),
                })}
              {hasDark && t(dark ? 'preview.darkSuffix' : 'preview.lightSuffix')}
              {hasMono && mono && t('preview.monochromeSuffix')}
              {hasMaskable && t(maskable ? 'preview.maskableSuffix' : 'preview.regularSuffix')}
              {/* Boolean() because the config is read as `unknown` per field, and
                  a bare `||` would put that straight into the tree. */}
              {Boolean(config.faviconSource || config.traySource) &&
                t('preview.dedicatedSourceSuffix')}
            </p>

            {isApple && <Hint>{t('preview.appleDisclaimer')}</Hint>}

            {/* Said out loud because the exported file stays square: a rounded
                preview would otherwise read as a claim about the PNG. */}
            {!isApple && mask.radius && (
              <Hint>{t('preview.osMaskDisclaimer', { platform: label })}</Hint>
            )}

            {platform === 'pwa' && (
              <Hint>
                {maskable
                  ? t('preview.pwaMaskableCaption')
                  : config.bgTransparent
                    ? t('preview.pwaRegularTransparentCaption')
                    : t('preview.pwaRegularFilledCaption')}
              </Hint>
            )}

            {platform === 'windowsStore' && (
              <Hint>
                {unplated ? t('preview.windowsStoreUnplated') : t('preview.windowsStoreTile')}
              </Hint>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const APPEARANCE_ICON: Record<AppleAppearance, React.ReactNode> = {
  light: <Sun size={12} weight="bold" />,
  dark: <Moon size={12} weight="bold" />,
  tinted: <Drop size={12} weight="bold" />,
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs leading-snug text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
      {children}
    </p>
  )
}

/**
 * A bordered on/off pill, for the two controls that are a state rather than a
 * choice between named options: watch shape, and monochrome. A two-segment
 * `SegmentedControl` would frame either as a pair of alternatives, which reads
 * wrong when the off state is simply "the normal icon".
 */
function TogglePill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={label}
      className={cn(
        'wj-focus-ring flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-[var(--color-neutral-700)] bg-[var(--color-neutral-700)] text-white dark:border-white dark:bg-white dark:text-[var(--color-neutral-900)]'
          : 'border-[var(--color-border-light)] bg-[var(--color-surface-light)] text-[var(--color-text-muted-light)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-text-muted-dark)]',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
