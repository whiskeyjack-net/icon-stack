import { useTranslation } from 'react-i18next'
import { cn } from '@whiskeyjack-net/design-system'
import { PLATFORM_LABELS } from '@whiskeyjack-net/icon-stack-core'
import { PLATFORM_ICONS } from '@/lib/platform-icons'
import { useGenerator, PLATFORMS } from '@/contexts/GeneratorContext'

/**
 * Which platforms the export includes.
 *
 * A multi-select tile grid, so the whole set is visible and switchable in one
 * gesture -- the alternative (a tab per platform, each with its own toggle)
 * hides ten of the eleven answers behind navigation.
 *
 * The DS `ToggleGroup` is the single-select version of this exact recipe but is
 * a `radiogroup` by construction, so the tiles are hand-rolled here as toggle
 * buttons. See FINDINGS.md: a multi-select `ToggleGroup` is the extraction that
 * would delete this file.
 */
export function PlatformGrid() {
  const { t } = useTranslation()
  const { platforms, togglePlatform } = useGenerator()

  return (
    <div role="group" aria-label={t('generator.platforms')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {PLATFORMS.map((key) => {
        const enabled = platforms[key].enabled
        const Icon = PLATFORM_ICONS[key]
        return (
          <button
            key={key}
            type="button"
            // Selection is a pressed state, not navigation -- and it is the
            // only thing distinguishing an included platform from an excluded
            // one for a screen reader, since the tint carries it visually.
            aria-pressed={enabled}
            onClick={() => togglePlatform(key)}
            className={cn(
              'wj-focus-ring touch-target flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-start text-sm font-medium transition-all',
              enabled
                ? 'border-[var(--color-accent-500)] bg-[var(--color-accent-500)] text-[var(--color-accent-foreground)] shadow-md'
                : [
                    'border-[var(--color-border-light)] bg-[var(--color-surface-light)]',
                    'text-[var(--color-text-secondary-light)] hover:border-[var(--color-accent-400)]',
                    'dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]',
                    'dark:text-[var(--color-text-secondary-dark)] dark:hover:border-[var(--color-neutral-500)]',
                  ],
            )}
          >
            <Icon size={18} weight={enabled ? 'fill' : 'regular'} className="shrink-0" />
            <span className="min-w-0 truncate">{PLATFORM_LABELS[key]}</span>
          </button>
        )
      })}
    </div>
  )
}
