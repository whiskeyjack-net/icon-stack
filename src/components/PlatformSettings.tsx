import { useTranslation } from 'react-i18next'
import { Card, CardContent, Slider, Toggle, ToggleGroup } from '@whiskeyjack-net/design-system'
import type {
  BackgroundFill,
  Platform,
  PlatformConfigs,
  SourceChoice,
} from '@whiskeyjack-net/icon-stack-core'
import { BackgroundEditor } from './BackgroundEditor'
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
  const { platforms, alternate, patchPlatform } = useGenerator()
  // Read generically so each control can be gated on its field existing;
  // the config union has no index signature, hence the step through unknown.
  const config = platforms[platform] as unknown as Record<string, unknown>

  const has = (key: string) => key in config
  const patch = (p: Partial<PlatformConfigs[Platform]>) => patchPlatform(platform, p)

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* --- Which artwork this platform draws from --------------------- */}
        {alternate && (
          <section className="space-y-4">
            <SectionTitle>{t('settings.artworkSource')}</SectionTitle>

            {has('sourceChoice') && (
              <SourcePicker
                label={t('settings.source.main')}
                value={config.sourceChoice as SourceChoice}
                onChange={(sourceChoice) => patch({ sourceChoice } as never)}
              />
            )}
            {has('lightSourceChoice') && (
              <SourcePicker
                label={t('settings.source.light')}
                value={config.lightSourceChoice as SourceChoice}
                onChange={(lightSourceChoice) => patch({ lightSourceChoice } as never)}
              />
            )}
            {has('darkSourceChoice') && (
              <SourcePicker
                label={t('settings.source.dark')}
                value={config.darkSourceChoice as SourceChoice}
                onChange={(darkSourceChoice) => patch({ darkSourceChoice } as never)}
              />
            )}
            {has('monoSourceChoice') && (
              <SourcePicker
                label={t('settings.source.mono')}
                value={config.monoSourceChoice as SourceChoice}
                onChange={(monoSourceChoice) => patch({ monoSourceChoice } as never)}
              />
            )}
            {has('maskableSourceChoice') && (
              <SourcePicker
                label={t('settings.source.maskable')}
                value={config.maskableSourceChoice as SourceChoice}
                onChange={(maskableSourceChoice) => patch({ maskableSourceChoice } as never)}
              />
            )}
            {has('unplatedSourceChoice') && (
              <SourcePicker
                label={t('settings.source.unplated')}
                value={config.unplatedSourceChoice as SourceChoice}
                onChange={(unplatedSourceChoice) => patch({ unplatedSourceChoice } as never)}
              />
            )}
          </section>
        )}

        {/* --- Background -------------------------------------------------- */}
        <section>
          <SectionTitle>{t('settings.background')}</SectionTitle>
          <BackgroundEditor
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

        {/* Platforms with a separate dark variant carry a second fill. */}
        {has('bgFillDark') && (
          <section>
            <SectionTitle>{t('settings.backgroundDark')}</SectionTitle>
            <BackgroundEditor
              fill={config.bgFillDark as BackgroundFill}
              onFillChange={(bgFillDark: BackgroundFill) => patch({ bgFillDark } as never)}
            />
          </section>
        )}

        {/* --- Apple .icon ------------------------------------------------- */}
        {platform === 'apple' && (
          <section className="space-y-5">
            <SectionTitle>{t('settings.appleIcon')}</SectionTitle>
            <p className="-mt-2 text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
              {t('settings.appleIconHint')}
            </p>

            <Toggle
              label={t('settings.glass')}
              description={t('settings.glassHint')}
              checked={config.glass as boolean}
              onChange={(glass) => patch({ glass } as never)}
            />

            <Slider
              label={t('settings.shadowOpacity')}
              min={0}
              max={100}
              step={1}
              value={Math.round((config.shadow as { opacity: number }).opacity * 100)}
              onChange={(v) => patch({ shadow: { kind: 'neutral', opacity: v / 100 } } as never)}
              formatValue={(v) => (v === 0 ? t('settings.none') : `${v}%`)}
            />

            <Toggle
              label={t('settings.translucency')}
              description={t('settings.translucencyHint')}
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
                label={t('settings.translucencyAmount')}
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
          <SectionTitle>{t('settings.artwork')}</SectionTitle>

          <Slider
            label={t('settings.zoom')}
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
                label={t('settings.cornerRadius')}
                min={0}
                max={50}
                step={1}
                value={config.cornerRadius as number}
                onChange={(cornerRadius) => patch({ cornerRadius } as never)}
                formatValue={(v) => (v === 0 ? t('settings.square') : `${v}%`)}
              />
              {(config.cornerRadius as number) > 0 && (
                <Slider
                  label={t('settings.cornerSmoothing')}
                  min={0}
                  max={100}
                  step={1}
                  value={config.cornerSmoothing as number}
                  onChange={(cornerSmoothing) => patch({ cornerSmoothing } as never)}
                  formatValue={(v) => (v === 0 ? t('settings.circular') : `${v}%`)}
                />
              )}
            </>
          )}

          {has('maskableZoom') && (
            <Slider
              label={t('settings.maskableZoom')}
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
              label={t('settings.unplatedZoom')}
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
            label={t('settings.monochrome')}
            description={t('settings.monochromeHint')}
            checked={config.useMonochrome as boolean}
            onChange={(useMonochrome) => patch({ useMonochrome } as never)}
          />
        )}

        {has('includeSvg') && (
          <Toggle
            label={t('settings.includeSvg')}
            description={t('settings.includeSvgHint')}
            checked={config.includeSvg as boolean}
            onChange={(includeSvg) => patch({ includeSvg } as never)}
          />
        )}

        <p className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
          {t(`settings.notes.${platform}`, { defaultValue: '' })}
        </p>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
      {children}
    </h3>
  )
}

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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
        {label}
      </span>
      <ToggleGroup
        value={value}
        onChange={onChange}
        options={[
          { value: 'main' as const, label: t('settings.source.useMain') },
          { value: 'alternate' as const, label: t('settings.source.useAlternate') },
        ]}
      />
    </div>
  )
}
