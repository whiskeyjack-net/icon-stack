import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomDrawer, ColorInput, DrawerAction, Toggle } from '@whiskeyjack-net/design-system'
import { Check, X } from '@phosphor-icons/react'
import {
  autoLighten,
  fillToCss,
  resolveGradientColors,
  type BackgroundFill,
  type GradientFill,
} from '@whiskeyjack-net/icon-stack-core'

export interface BackgroundEditorProps {
  open: boolean
  fill: BackgroundFill
  onChange: (fill: BackgroundFill) => void
  onClose: () => void
  title: string
}

/**
 * The background fill editor, in a drawer.
 *
 * It was a stack of inline controls -- a solid/gradient segmented control, a
 * preset row, a colour input, a second input for the gradient top -- sitting
 * permanently open inside the settings card. Two problems. It put six controls
 * on screen for a setting most people touch once, and it applied every change
 * straight to the platform config, so there was no way to try a colour and back
 * out.
 *
 * A drawer with a deferred edit fixes both: the draft is local until Save, and
 * dismissing (backdrop, Escape, swipe-down, Back) discards. The draft is
 * re-seeded on each open so a cancelled edit cannot leak into the next one.
 *
 * Composed entirely from design-system parts -- `BottomDrawer`, `DrawerAction`,
 * `Toggle`, `ColorInput`. Only the deferred-edit wiring is app code, and that is
 * genuinely app-specific: it knows what a `BackgroundFill` is.
 *
 * The `auto` top stop comes from the core's `autoLighten`. The inline version
 * carried its own copy of that maths to colour a swatch, which is the kind of
 * duplicate that drifts from the pipeline it is meant to be previewing.
 */
export function BackgroundEditor({ open, fill, onChange, onClose, title }: BackgroundEditorProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<BackgroundFill>(fill)

  // Seeded on open only. Tracking `fill` too would overwrite an in-progress edit
  // the moment anything upstream re-rendered.
  useEffect(() => {
    if (open) setDraft(fill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isGradient = draft.type === 'gradient'
  const isAuto = isGradient && draft.gradient.topColor === 'auto'
  const dirty = JSON.stringify(draft) !== JSON.stringify(fill)
  const resolved = draft.type === 'gradient' ? resolveGradientColors(draft.gradient) : null

  const toggleGradient = (checked: boolean) => {
    const base = draft.type === 'solid' ? draft.color : draft.gradient.bottomColor
    setDraft(
      checked
        ? { type: 'gradient', gradient: { topColor: 'auto', bottomColor: base } }
        : { type: 'solid', color: base },
    )
  }

  const setGradient = (patch: Partial<GradientFill>) => {
    if (draft.type !== 'gradient') return
    setDraft({ type: 'gradient', gradient: { ...draft.gradient, ...patch } })
  }

  return (
    <BottomDrawer
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <DrawerAction icon={<X />} label={t('background.cancel')} onClick={onClose} />
          <DrawerAction
            icon={<Check />}
            label={t('background.save')}
            disabled={!dirty}
            onClick={() => {
              onChange(draft)
              onClose()
            }}
          />
        </>
      }
    >
      <div className="space-y-5">
        {/* Big enough to judge a gradient by, which a 28px swatch is not. */}
        <div
          className="h-24 w-full rounded-xl border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]"
          style={{ background: fillToCss(draft) }}
        />

        <Toggle
          label={t('background.useGradient')}
          checked={isGradient}
          onChange={toggleGradient}
        />

        {draft.type === 'solid' && (
          <ColorRow
            label={t('background.color')}
            value={draft.color}
            onChange={(color) => setDraft({ type: 'solid', color })}
          />
        )}

        {draft.type === 'gradient' && (
          <div className="space-y-4">
            {/* The top stop is derived from the bottom one by default, which is
                what makes a one-colour gradient possible at all. */}
            <Toggle
              label={t('background.automaticTopColor')}
              checked={isAuto}
              onChange={(checked) =>
                setGradient({
                  topColor: checked ? 'auto' : autoLighten(draft.gradient.bottomColor),
                })
              }
            />
            <ColorRow
              label={t('background.topColor')}
              value={resolved?.top ?? '#FFFFFF'}
              disabled={isAuto}
              onChange={(topColor) => setGradient({ topColor })}
            />
            <ColorRow
              label={t('background.bottomColor')}
              value={draft.gradient.bottomColor}
              onChange={(bottomColor) => setGradient({ bottomColor })}
            />
          </div>
        )}
      </div>
    </BottomDrawer>
  )
}

function ColorRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
        {label}
      </span>
      <ColorInput
        value={value}
        onChange={onChange}
        disabled={disabled}
        showHex
        aria-label={t('background.colorPickerAriaLabel', { label })}
      />
    </div>
  )
}
