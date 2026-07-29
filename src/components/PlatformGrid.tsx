import { useTranslation } from 'react-i18next'
import { CheckboxGroup } from '@whiskeyjack-net/design-system'
import { PLATFORM_LABELS, type Platform } from '@whiskeyjack-net/icon-stack-core'
import { PLATFORM_ICONS } from '@/lib/platform-icons'
import { useGenerator, PLATFORMS } from '@/contexts/GeneratorContext'

/**
 * Which platforms the export includes.
 *
 * The whole set stays visible and switchable in one gesture -- the alternative
 * (a tab per platform, each with its own toggle) hides ten of the eleven answers
 * behind navigation.
 *
 * This was a hand-rolled tile grid until design-system 0.9.0 shipped
 * `CheckboxGroup`. It is that component's first external consumer, and the tiles
 * now match `ToggleGroup`'s by construction rather than by having been copied
 * from it.
 */
export function PlatformGrid() {
  const { t } = useTranslation()
  const { platforms, setEnabledPlatforms } = useGenerator()

  const options = PLATFORMS.map((p) => {
    const Icon = PLATFORM_ICONS[p]
    return { value: p, label: PLATFORM_LABELS[p], icon: <Icon size={18} /> }
  })

  return (
    <CheckboxGroup
      aria-label={t('generator.platforms')}
      options={options}
      value={PLATFORMS.filter((p) => platforms[p].enabled)}
      onChange={(next) => setEnabledPlatforms(next as Platform[])}
    />
  )
}
