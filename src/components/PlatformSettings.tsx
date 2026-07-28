import { useTranslation } from 'react-i18next'
import { Card, CardContent, Slider } from '@whiskeyjack-net/design-system'
import type { BackgroundFill, Platform, PlatformConfigs } from '@whiskeyjack-net/icon-stack-core'
import { BackgroundEditor } from './BackgroundEditor'

export interface PlatformSettingsProps {
  platform: Platform
  config: PlatformConfigs[Platform]
  onChange: (patch: Partial<PlatformConfigs[Platform]>) => void
}

/**
 * Per-platform controls.
 *
 * `AppleConfig` deliberately is not a `PlatformConfig` -- the `.icon` format
 * owns its own corner and background treatment -- so every control here is
 * gated on the field existing rather than cast into place.
 */
export function PlatformSettings({ platform, config, onChange }: PlatformSettingsProps) {
  const { t } = useTranslation()

  const hasCorners = 'cornerRadius' in config
  const hasTransparency = 'bgTransparent' in config

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <section>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
            {t('settings.background')}
          </h3>
          <BackgroundEditor
            fill={config.bgFill}
            onFillChange={(bgFill: BackgroundFill) => onChange({ bgFill })}
            transparent={hasTransparency ? config.bgTransparent : undefined}
            onTransparentChange={
              hasTransparency ? (bgTransparent) => onChange({ bgTransparent }) : undefined
            }
          />
        </section>

        <section className="space-y-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
            {t('settings.artwork')}
          </h3>

          <Slider
            label={t('settings.zoom')}
            min={50}
            max={150}
            step={1}
            value={config.zoom}
            onChange={(zoom) => onChange({ zoom })}
            formatValue={(v) => `${v}%`}
          />

          {hasCorners && (
            <>
              <Slider
                label={t('settings.cornerRadius')}
                min={0}
                max={50}
                step={1}
                value={config.cornerRadius}
                onChange={(cornerRadius) => onChange({ cornerRadius })}
                formatValue={(v) => (v === 0 ? t('settings.square') : `${v}%`)}
              />
              {config.cornerRadius > 0 && (
                <Slider
                  label={t('settings.cornerSmoothing')}
                  min={0}
                  max={100}
                  step={1}
                  value={config.cornerSmoothing}
                  onChange={(cornerSmoothing) => onChange({ cornerSmoothing })}
                  formatValue={(v) => (v === 0 ? t('settings.circular') : `${v}%`)}
                />
              )}
            </>
          )}
        </section>

        <p className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
          {t(`settings.notes.${platform}`, { defaultValue: '' })}
        </p>
      </CardContent>
    </Card>
  )
}
