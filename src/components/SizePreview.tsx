import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  Notice,
  SegmentedControl,
  cn,
  compactControlClass,
} from '@whiskeyjack-net/design-system'
import {
  AppWindow,
  BoundingBox,
  Circle,
  Drop,
  ImageSquare,
  Moon,
  Shuffle,
  SquaresFour,
  Sun,
  Watch,
} from '@phosphor-icons/react'
import {
  PLATFORM_LABELS,
  fillToCss,
  type BackgroundFill,
  type Platform,
} from '@whiskeyjack-net/icon-stack-core'
import { useGenerator } from '@/contexts/GeneratorContext'
import { groupByVariant, sizesOf, type IconVariant, type RenderedIcon } from '@/lib/icon-variants'
import { osMaskFor } from '@/lib/os-mask'
import {
  APPLE_APPEARANCES,
  IOS_DARK_PLATE,
  TINTED_PLATE,
  appleLayerFor,
  type AppleAppearance,
} from '@/lib/apple-appearance'
import { DEFAULT_BACKDROP, backdropStyle, randomBackdrop } from '@/lib/backdrop'

/** Largest the preview is drawn. A 1024px icon at 1:1 is taller than its rail. */
const DISPLAY_MAX = 256

/**
 * At or below this, the icon is shown magnified `MAGNIFY` times with
 * `image-rendering: pixelated`, so the pixels the pipeline resampled are
 * inspectable rather than flattered by the browser's smoothing.
 *
 * Above it, one image pixel is drawn per DEVICE pixel. An `<img>` sized in CSS
 * pixels is upscaled by the display's ratio, so on a Retina screen a 48px file
 * used to cover 96 device pixels with bilinear smoothing -- softer than the file,
 * and softer than the OS shows it. That was the whole of a perceived quality
 * regression against the monorepo build, whose preview drew from the source at
 * device resolution. The bytes never changed; the display did.
 */
const PIXELATED_UPTO = 32
const MAGNIFY = 2

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
const HIDDEN: Partial<Record<Platform, IconVariant[]>> = {
  android: ['foreground', 'background'],
  // The plain target-size icons: Windows plates them itself, so on their own they
  // are the tile's artwork at taskbar sizes, and the Tile and Taskbar views
  // between them already show both halves of that.
  windowsStore: ['plated'],
}

/**
 * Whether this platform's export draws the corner into the PNG.
 *
 * Read off the config rather than listed here. It WAS a list -- and it said
 * windows/linux/favicon while the pipeline also rounded pwa and windowsStore, so
 * it was wrong the day it was written. `cornerRadius` now exists only on the
 * configs whose export rounds (`RoundedCornersConfig`), which makes the question
 * answerable from the data instead of from a copy of it.
 */
const bakesCorners = (config: Record<string, unknown>) => 'cornerRadius' in config

export interface SizePreviewProps {
  platform: Platform
  /**
   * Card heading, or omitted for no heading at all.
   *
   * The Source tab stacks one card per enabled platform and passes each platform's
   * name, since identical headings would make them indistinguishable. A platform
   * tab passes nothing: the tab names the platform and the settings card beside it
   * carries the heading, so the preview repeating it is a third copy of one word.
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
  const { source, platforms, alternate, sourceFit, alternateFit, faviconFit, trayFit, render } =
    useGenerator()
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
  const [taskbar, setTaskbar] = useState(false)
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
        console.error(err)
        setError(t('preview.failed'))
      } finally {
        if (run === runRef.current) setPending(false)
      }
    }, 250)

    return () => clearTimeout(timer)
    // This platform's own config, rather than the whole map: on the Source tab
    // every enabled platform's preview is mounted, and a change to one must not
    // re-run the other ten pipelines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, platforms[platform], source, alternate, sourceFit, alternateFit, faviconFit, trayFit, render, t])

  const hidden = HIDDEN[platform] ?? []
  const available = [...variants.keys()].filter((v) => !hidden.includes(v))
  const has = (v: IconVariant) => available.includes(v)
  const config = platforms[platform] as unknown as Record<string, unknown>

  const isApple = platform === 'apple'
  const isStore = platform === 'windowsStore'
  // A Windows Store export's dark and light variants are its taskbar icons, so
  // the appearance strip only means something once Taskbar is chosen.
  const hasDark = has('dark') && (!isStore || taskbar)
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
  else if (isStore) shown = taskbar ? (dark ? 'dark' : 'light') : 'regular'
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
    bakesCorners(config) && !config.bgTransparent && Number(config.cornerRadius ?? 0) > 0

  // An Apple Watch icon is circular whatever the desktop does with the same file.
  // Otherwise: only what the OS applies. A baked corner is in the pixels already,
  // and a baked squircle is a superellipse that CSS `border-radius` cannot
  // express -- rounding on top of either clips the shape the pipeline just drew.
  const radius = isApple && watch ? '50%' : bakesACorner && smoothing > 0 ? null : mask.radius

  // Two exports ship a transparent file the OS puts its own plate behind: Apple's
  // layered icon declares one in icon.json, and a legacy iOS dark icon gets the
  // system's dark gradient. Both are supplied here, since the file alone is
  // artwork on nothing.
  const iosDark = platform === 'ios' && (shown === 'dark' || shown === 'mono')
  const plate = isApple
    ? appearance === 'tinted'
      ? TINTED_PLATE
      : fillToCss((appearance === 'dark' ? config.bgFillDark : config.bgFill) as BackgroundFill)
    : iosDark
      ? IOS_DARK_PLATE
      : null

  // Small sizes magnified in device pixels; everything else one file pixel per
  // device pixel, so the browser never resamples what the pipeline produced.
  // Past DISPLAY_MAX the browser scales down, which only ever costs detail
  // nobody is inspecting at that size.
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const magnified = selected !== null && selected <= PIXELATED_UPTO
  const display =
    selected === null ? 0 : magnified ? (selected * MAGNIFY) / dpr : Math.min(selected / dpr, DISPLAY_MAX)
  const actualPixels = selected !== null && !magnified && selected / dpr <= DISPLAY_MAX
  const label = PLATFORM_LABELS[platform]

  return (
    <Card>
      <CardContent density="compact">
        {title && (
          <h3 className="mb-4 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {title}
          </h3>
        )}

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
                    // Geometry from the DS recipe, so the chips, the segmented
                    // controls and the pills below all land on one line. Only the
                    // fill is local: a chosen size is a neutral rather than the
                    // accent, which the strips keep for "one of several".
                    className={cn(
                      compactControlClass(),
                      'font-mono',
                      s === selected
                        ? 'bg-[var(--color-neutral-700)] text-white dark:bg-[var(--color-neutral-300)] dark:text-[var(--color-neutral-900)]'
                        : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary-light)] hover:bg-[var(--color-warm-100)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-text-secondary-dark)] dark:hover:bg-[var(--color-surface-muted-dark)]',
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

              {/* A Windows Store export is two things: tiles on the manifest's
                  plate, and bare taskbar icons. One control picks which. */}
              {isStore && (
                <SegmentedControl
                  aria-label={t('preview.surfaceLabel')}
                  value={taskbar ? 'taskbar' : 'tile'}
                  onChange={(v) => setTaskbar(v === 'taskbar')}
                  options={[
                    {
                      value: 'tile',
                      label: t('preview.tile'),
                      icon: <SquaresFour size={12} weight="bold" />,
                    },
                    {
                      value: 'taskbar',
                      label: t('preview.taskbar'),
                      icon: <AppWindow size={12} weight="bold" />,
                    },
                  ]}
                />
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
                    alt={t('preview.canvasAriaLabel', { size: selected, platform: label })}
                    style={{
                      width: display,
                      height: display,
                      imageRendering: magnified ? 'pixelated' : 'auto',
                      ...(appleLayer?.monochrome ? { filter: 'brightness(0) invert(1)' } : null),
                    }}
                  />
                )}
              </div>
            </div>

            {/* --- What you are looking at ----------------------------------- */}
            <p className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
              {t('preview.captionBase', { size: selected, platform: label })}
              {magnified && t('preview.magnifiedSuffix', { factor: MAGNIFY })}
              {actualPixels && t('preview.actualPixelsSuffix')}
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

            {isStore && (
              <Hint>
                {taskbar ? t('preview.windowsStoreUnplated') : t('preview.windowsStoreTile')}
              </Hint>
            )}

            {iosDark && <Hint>{t('preview.iosDarkCaption')}</Hint>}
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
        // Same recipe as the chips and the segmented strips. Tailwind's
        // border-box means adding a border here costs no height, so a bordered
        // pill still lines up with an unbordered chip.
        compactControlClass(),
        'border',
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
