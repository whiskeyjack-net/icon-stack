import { useTranslation } from 'react-i18next'
import { Card, CardContent, Slider, Toggle, ToggleGroup } from '@whiskeyjack-net/design-system'
import type {
  BackgroundFill,
  Platform,
  PlatformConfigs,
  SourceChoice,
  SourceImage,
} from '@whiskeyjack-net/icon-stack-core'
import { BackgroundField } from './BackgroundField'
import { DedicatedSource } from './DedicatedSource'
import { useGenerator } from '@/contexts/GeneratorContext'

/**
 * Per-platform controls.
 *
 * Every control is gated on the field existing rather than cast into place:
 * `AppleConfig` deliberately is not a `PlatformConfig` (the `.icon` format owns
 * its own corner and background treatment), and several platforms carry fields
 * no other one has.
 */
export function PlatformSettings({ platform }: { platform: Platform }) {
  const { t } = useTranslation()
  const { platforms, alternate, patchPlatform, faviconFit, trayFit, setFaviconFit, setTrayFit } =
    useGenerator()
  // Read generically so each control can be gated on its field existing;
  // the config union has no index signature, hence the step through unknown.
  const config = platforms[platform] as unknown as Record<string, unknown>

  const has = (key: string) => key in config
  const patch = (p: Partial<PlatformConfigs[Platform]>) => patchPlatform(platform, p)

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* --- A source belonging to this platform alone ------------------- */}
        {has('faviconSource') && (
          <DedicatedSource
            label={t('platform.faviconSource')}
            hint={t('platform.faviconSourceHint')}
            value={config.faviconSource as SourceImage | null}
            onChange={(faviconSource) => patch({ faviconSource } as never)}
            fit={faviconFit}
            onFitChange={setFaviconFit}
          />
        )}
        {has('traySource') && (
          <DedicatedSource
            label={t('platform.traySource')}
            hint={t('platform.traySourceHint')}
            value={config.traySource as SourceImage | null}
            onChange={(traySource) => patch({ traySource } as never)}
            fit={trayFit}
            onFitChange={setTrayFit}
          />
        )}

        {/* --- Which artwork this platform draws from --------------------- */}
        {alternate && (
          <section className="space-y-4">
            <SectionTitle>{t('platform.artworkSource')}</SectionTitle>

            {has('sourceChoice') && (
              <SourcePicker
                label={t('platform.source.main')}
                value={config.sourceChoice as SourceChoice}
                onChange={(sourceChoice) => patch({ sourceChoice } as never)}
              />
            )}
            {has('lightSourceChoice') && (
              <SourcePicker
                label={t('platform.source.light')}
                value={config.lightSourceChoice as SourceChoice}
                onChange={(lightSourceChoice) => patch({ lightSourceChoice } as never)}
              />
            )}
            {has('darkSourceChoice') && (
              <SourcePicker
                label={t('platform.source.dark')}
                value={config.darkSourceChoice as SourceChoice}
                onChange={(darkSourceChoice) => patch({ darkSourceChoice } as never)}
              />
            )}
            {has('monoSourceChoice') && (
              <SourcePicker
                label={t('platform.source.mono')}
                value={config.monoSourceChoice as SourceChoice}
                onChange={(monoSourceChoice) => patch({ monoSourceChoice } as never)}
              />
            )}
            {has('maskableSourceChoice') && (
              <SourcePicker
                label={t('platform.source.maskable')}
                value={config.maskableSourceChoice as SourceChoice}
                onChange={(maskableSourceChoice) => patch({ maskableSourceChoice } as never)}
              />
            )}
            {has('unplatedSourceChoice') && (
              <SourcePicker
                label={t('platform.source.unplated')}
                value={config.unplatedSourceChoice as SourceChoice}
                onChange={(unplatedSourceChoice) => patch({ unplatedSourceChoice } as never)}
              />
            )}
          </section>
        )}

        {/* --- Background -------------------------------------------------- */}
        <section>
          <BackgroundField
            label={t('platform.background')}
            fill={config.bgFill as BackgroundFill}
            onFillChange={(bgFill: BackgroundFill) => patch({ bgFill } as never)}
            transparent={has('bgTransparent') ? (config.bgTransparent as boolean) : undefined}
            onTransparentChange={
              has('bgTransparent')
                ? (bgTransparent) => patch({ bgTransparent } as never)
                : undefined
            }
          />
        </section>

        {/* The maskable variant is cropped by the OS, so the plate that shows
            around the mark is often not the one the plain icon wants. */}
        {has('maskableBgFill') && (
          <section>
            <BackgroundField
              label={t('platform.maskableBackground')}
              fill={config.maskableBgFill as BackgroundFill}
              onFillChange={(maskableBgFill: BackgroundFill) =>
                patch({ maskableBgFill } as never)
              }
            />
          </section>
        )}

        {/* Windows Store taskbar icons: unlike the tiles, their background IS
            baked into the exported PNGs, so it gets its own controls. */}
        {has('unplatedBgFill') && (
          <section>
            <BackgroundField
              label={t('platform.unplatedBackground')}
              fill={config.unplatedBgFill as BackgroundFill}
              onFillChange={(unplatedBgFill: BackgroundFill) =>
                patch({ unplatedBgFill } as never)
              }
              transparent={config.unplatedTransparent as boolean}
              onTransparentChange={(unplatedTransparent) =>
                patch({ unplatedTransparent } as never)
              }
            />
          </section>
        )}

        {/* Platforms with a separate dark variant carry a second fill. */}
        {has('bgFillDark') && (
          <section>
            <BackgroundField
              label={t('platform.backgroundDark')}
              fill={config.bgFillDark as BackgroundFill}
              onFillChange={(bgFillDark: BackgroundFill) => patch({ bgFillDark } as never)}
            />
          </section>
        )}

        {/* --- Apple .icon ------------------------------------------------- */}
        {platform === 'apple' && (
          <section className="space-y-5">
            <SectionTitle>{t('platform.appleIcon')}</SectionTitle>
            <p className="-mt-2 text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
              {t('platform.appleIconHint')}
            </p>

            <Toggle
              label={t('platform.glass')}
              description={t('platform.glassHint')}
              checked={config.glass as boolean}
              onChange={(glass) => patch({ glass } as never)}
            />

            <Slider
              label={t('platform.shadowOpacity')}
              min={0}
              max={100}
              step={1}
              value={Math.round((config.shadow as { opacity: number }).opacity * 100)}
              onChange={(v) => patch({ shadow: { kind: 'neutral', opacity: v / 100 } } as never)}
              formatValue={(v) => (v === 0 ? t('platform.none') : `${v}%`)}
            />

            <Toggle
              label={t('platform.translucency')}
              description={t('platform.translucencyHint')}
              checked={(config.translucency as { enabled: boolean }).enabled}
              onChange={(enabled) =>
                patch({
                  translucency: {
                    enabled,
                    value: (config.translucency as { value: number }).value,
                  },
                } as never)
              }
            />

            {(config.translucency as { enabled: boolean }).enabled && (
              <Slider
                label={t('platform.translucencyAmount')}
                min={0}
                max={100}
                step={1}
                value={Math.round((config.translucency as { value: number }).value * 100)}
                onChange={(v) =>
                  patch({ translucency: { enabled: true, value: v / 100 } } as never)
                }
                formatValue={(v) => `${v}%`}
              />
            )}
          </section>
        )}

        {/* --- Artwork geometry -------------------------------------------- */}
        <section className="space-y-5">
          <SectionTitle>{t('platform.artwork')}</SectionTitle>

          <Slider
            label={t('platform.zoom')}
            min={50}
            max={150}
            step={1}
            value={config.zoom as number}
            onChange={(zoom) => patch({ zoom } as never)}
            formatValue={(v) => `${v}%`}
          />

          {has('cornerRadius') && (
            <>
              <Slider
                label={t('platform.cornerRadius')}
                min={0}
                max={50}
                step={1}
                value={config.cornerRadius as number}
                onChange={(cornerRadius) => patch({ cornerRadius } as never)}
                formatValue={(v) => (v === 0 ? t('platform.square') : `${v}%`)}
              />
              {(config.cornerRadius as number) > 0 && (
                <Slider
                  label={t('platform.cornerSmoothing')}
                  min={0}
                  max={100}
                  step={1}
                  value={config.cornerSmoothing as number}
                  onChange={(cornerSmoothing) => patch({ cornerSmoothing } as never)}
                  formatValue={(v) => (v === 0 ? t('platform.circular') : `${v}%`)}
                />
              )}
            </>
          )}

          {has('maskableZoom') && (
            <Slider
              label={t('platform.maskableZoom')}
              min={50}
              max={150}
              step={1}
              value={config.maskableZoom as number}
              onChange={(maskableZoom) => patch({ maskableZoom } as never)}
              formatValue={(v) => `${v}%`}
            />
          )}

          {has('unplatedZoom') && (
            <Slider
              label={t('platform.unplatedZoom')}
              min={50}
              max={150}
              step={1}
              value={config.unplatedZoom as number}
              onChange={(unplatedZoom) => patch({ unplatedZoom } as never)}
              formatValue={(v) => `${v}%`}
            />
          )}
        </section>

        {/* --- Platform extras --------------------------------------------- */}
        {has('useMonochrome') && (
          <Toggle
            label={t('platform.monochrome')}
            description={t('platform.monochromeHint')}
            checked={config.useMonochrome as boolean}
            onChange={(useMonochrome) => patch({ useMonochrome } as never)}
          />
        )}

        {has('includeSvg') && (
          <Toggle
            label={t('platform.includeSvg')}
            description={t('platform.includeSvgHint')}
            checked={config.includeSvg as boolean}
            onChange={(includeSvg) => patch({ includeSvg } as never)}
          />
        )}

        {/* Nested under includeSvg on purpose: with no SVG favicon emitted there
            is nothing for a dark-mode media query to live in. */}
        {has('svgDarkMode') && (config.includeSvg as boolean) && (
          <Toggle
            label={t('platform.svgDarkMode')}
            description={t('platform.svgDarkModeHint')}
            checked={config.svgDarkMode as boolean}
            onChange={(svgDarkMode) => patch({ svgDarkMode } as never)}
          />
        )}

        <p className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
          {t(`platform.notes.${platform}`, { defaultValue: '' })}
        </p>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
      {children}
    </h3>
  )
}

/**
 * Which of the two loaded sources this platform draws from.
 *
 * Each option carries a thumbnail of the image it selects, which the monorepo
 * version had and the rebuild dropped: the labels are "Main" and "Alternate",
 * and those words say nothing about which artwork you are choosing. With two
 * images loaded, the thumbnail IS the answer.
 *
 * No new component was needed for it. `ToggleGroupOption.icon` is already
 * `ReactNode`, documented as caller-supplied precisely because the design system
 * bundles no icon library -- an `<img>` is as valid there as a Phosphor glyph.
 * The gap was in how this called it rather than in the primitive.
 */
function SourcePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: SourceChoice
  onChange: (value: SourceChoice) => void
}) {
  const { t } = useTranslation()
  const { source, alternate } = useGenerator()

  const thumb = (image: SourceImage | null) =>
    image ? (
      <img
        src={image.dataUrl}
        alt=""
        className="h-5 w-5 rounded-sm bg-[var(--color-neutral-200)] object-contain dark:bg-[var(--color-neutral-700)]"
      />
    ) : undefined

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
        {label}
      </span>
      <ToggleGroup
        value={value}
        onChange={onChange}
        options={[
          { value: 'main' as const, label: t('platform.source.useMain'), icon: thumb(source) },
          {
            value: 'alternate' as const,
            label: t('platform.source.useAlternate'),
            icon: thumb(alternate),
          },
        ]}
      />
    </div>
  )
}
