import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Toggle } from '@whiskeyjack-net/design-system'
import { fillToCss, resolveFillColor, type BackgroundFill } from '@whiskeyjack-net/icon-stack-core'
import { BackgroundEditor } from './BackgroundEditor'

export interface BackgroundFieldProps {
  label: string
  fill: BackgroundFill
  onFillChange: (fill: BackgroundFill) => void
  /** Platforms whose output is always transparent omit this entirely. */
  transparent?: boolean
  onTransparentChange?: (transparent: boolean) => void
}

/**
 * One background setting: a row, and the drawer it opens.
 *
 * Label on the left, the current fill as a swatch on the right, and the whole
 * editor behind it. A platform can carry three of these (plate, maskable plate,
 * unplated taskbar plate), so the inline form this replaces meant three stacked
 * blocks of six controls each in one settings card.
 *
 * ## Why this is app code rather than a design-system component
 *
 * The swatch-that-opens-an-editor is a real pattern, and a `SwatchField` would
 * be a reasonable component. It is not one yet, on the repo's own rule that an
 * extraction needs a second consumer: this is the only place in any Whiskeyjack
 * app that does it. Chip Away's accent setting is the closest thing and it uses
 * `ColorInput` inline, because a single hex needs no editor behind it.
 *
 * What makes this different is the gradient. `ColorInput` is a hex control by
 * construction -- `value: string`, `onChange: (hex: string)` -- so it cannot
 * represent a two-stop fill with an auto-derived top, which is exactly what the
 * drawer exists to edit. A component that took a `BackgroundFill` would be
 * importing this app's domain type into the design system.
 *
 * If a second app grows a fill-with-gradient setting, the extraction to reach
 * for is the generic shape: a labelled row whose trailing control is a preview
 * button opening a caller-supplied editor. That is worth building for two
 * consumers, and guesswork for one.
 */
export function BackgroundField({
  label,
  fill,
  onFillChange,
  transparent,
  onTransparentChange,
}: BackgroundFieldProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const isTransparent = transparent === true

  return (
    <div className="space-y-3">
      {onTransparentChange && (
        <Toggle
          label={t('background.transparent')}
          description={t('background.transparentHint')}
          checked={isTransparent}
          onChange={onTransparentChange}
        />
      )}

      {/* Hidden rather than disabled when transparent: there is no fill to edit,
          so a greyed-out swatch would be showing a colour that does not apply. */}
      {!isTransparent && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
              {label}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                {fill.type === 'gradient' ? t('background.gradient') : resolveFillColor(fill)}
              </span>
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={t('background.edit', { label })}
                title={t('background.edit', { label })}
                className="wj-focus-ring h-7 w-7 cursor-pointer rounded-lg border-2 border-[var(--color-border-light)] transition-shadow hover:shadow-md dark:border-[var(--color-border-dark)]"
                style={{ background: fillToCss(fill) }}
              />
            </div>
          </div>

          <BackgroundEditor
            open={open}
            fill={fill}
            onChange={onFillChange}
            onClose={() => setOpen(false)}
            title={label}
          />
        </>
      )}
    </div>
  )
}
