import { useTranslation } from 'react-i18next'
import { ColorInput, Toggle, ToggleGroup } from '@whiskeyjack-net/design-system'
import { PaintBucket, Drop } from '@phosphor-icons/react'
import type { BackgroundFill } from '@whiskeyjack-net/icon-stack-core'

/** A small palette of sensible plates, so the picker is not the only route. */
const PRESETS = ['#FFFFFF', '#F2F0ED', '#1D1D1D', '#1E90FF', '#0FB9B1', '#E66767']

export interface BackgroundEditorProps {
  fill: BackgroundFill
  onFillChange: (fill: BackgroundFill) => void
  /** Platforms whose output is always transparent hide the toggle entirely. */
  transparent?: boolean
  onTransparentChange?: (transparent: boolean) => void
}

export function BackgroundEditor({
  fill,
  onFillChange,
  transparent,
  onTransparentChange,
}: BackgroundEditorProps) {
  const { t } = useTranslation()

  const solidColor = fill.type === 'solid' ? fill.color : fill.gradient.bottomColor
  const topColor = fill.type === 'gradient' ? fill.gradient.topColor : 'auto'

  const setKind = (kind: 'solid' | 'gradient') => {
    onFillChange(
      kind === 'solid'
        ? { type: 'solid', color: solidColor }
        : { type: 'gradient', gradient: { topColor: 'auto', bottomColor: solidColor } },
    )
  }

  const disabled = transparent === true

  return (
    <div className="space-y-4">
      {onTransparentChange && (
        <Toggle
          label={t('background.transparent')}
          description={t('background.transparentHint')}
          checked={transparent ?? false}
          onChange={onTransparentChange}
        />
      )}

      <div className={disabled ? 'pointer-events-none opacity-40' : undefined}>
        <ToggleGroup
          value={fill.type}
          onChange={setKind}
          options={[
            { value: 'solid' as const, label: t('background.solid'), icon: <PaintBucket size={18} weight="duotone" /> },
            { value: 'gradient' as const, label: t('background.gradient'), icon: <Drop size={18} weight="duotone" /> },
          ]}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map((hex) => (
            <ColorInput
              key={hex}
              value={hex}
              onChange={() => setBase(hex)}
              aria-label={t('background.preset', { color: hex })}
              size="sm"
              selected={solidColor.toUpperCase() === hex}
              disabled={disabled}
            />
          ))}
          <ColorInput
            value={solidColor}
            onChange={setBase}
            aria-label={t('background.custom')}
            icon={<PaintBucket size={14} weight="fill" />}
            showHex
            disabled={disabled}
          />
        </div>

        {fill.type === 'gradient' && (
          <div className="mt-4 flex items-center gap-3">
            <ColorInput
              value={topColor === 'auto' ? lighten(solidColor) : topColor}
              onChange={(hex) =>
                onFillChange({ type: 'gradient', gradient: { topColor: hex, bottomColor: solidColor } })
              }
              aria-label={t('background.gradientTop')}
              unset={topColor === 'auto'}
              showHex
              disabled={disabled}
            />
            <span className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
              {topColor === 'auto' ? t('background.autoTop') : t('background.customTop')}
            </span>
          </div>
        )}
      </div>
    </div>
  )

  function setBase(hex: string) {
    onFillChange(
      fill.type === 'solid'
        ? { type: 'solid', color: hex }
        : { type: 'gradient', gradient: { topColor: fill.gradient.topColor, bottomColor: hex } },
    )
  }
}

/** Mirrors the core's `auto` top stop closely enough for the swatch preview. */
function lighten(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35)
  return (
    '#' +
    [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((c) => mix(c).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}
