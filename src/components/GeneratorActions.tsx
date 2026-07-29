import { useTranslation } from 'react-i18next'
import { ActionPill, ActionPillButton } from '@whiskeyjack-net/design-system'
import { DownloadSimple, Plus } from '@phosphor-icons/react'
import { useGenerator } from '@/contexts/GeneratorContext'

/**
 * The app's toolbar action, for the desktop header and the mobile bottom nav.
 *
 * ONE action at a time, and which one is the whole design: with no source the
 * only thing worth offering is adding one, and once there is a source the only
 * thing worth offering is the export. The two swap in place.
 *
 * It briefly carried three buttons -- clear, upload/replace, export -- which
 * read as a toolbar of equals and duplicated controls that already live on the
 * source cards, where they have the file in front of them. `SourceSlots` owns
 * remove (per slot) and replace (with its confirmation), so nothing was lost by
 * taking them out of here.
 *
 * Same button in the same place on both sizes, per the design system's rule;
 * only `size` differs.
 */
export function GeneratorActions({ size }: { size: 'desktop' | 'mobile' }) {
  const { t } = useTranslation()
  const { source, platforms, busy, generate, triggerUpload } = useGenerator()

  const showExport = Boolean(source)
  const enabledCount = Object.values(platforms).filter((p) => p.enabled).length
  const canExport = showExport && enabledCount > 0 && !busy
  const iconSize = size === 'mobile' ? 24 : 20

  return (
    <ActionPill size={size}>
      <ActionPillButton
        visible={showExport}
        disabled={!canExport}
        icon={<DownloadSimple size={iconSize} weight="bold" />}
        label={t('actions.export')}
        size={size}
        onClick={() => void generate('all')}
      />
      <ActionPillButton
        visible={!showExport}
        icon={<Plus size={iconSize} weight="bold" />}
        label={t('actions.upload')}
        size={size}
        onClick={triggerUpload}
      />
    </ActionPill>
  )
}

/**
 * Worst-case copy for `MobileBottomNav`'s overflow measurement, which the design
 * system defines as "every action visible".
 *
 * Only one is ever on screen, so this deliberately over-reserves. That is the
 * documented trade: a stable collapse decision beats a nav that flips between
 * inline and hamburger the moment a source is added.
 */
export function GeneratorActionsMeasure() {
  const { t } = useTranslation()
  return (
    <ActionPill size="mobile">
      <ActionPillButton
        visible
        icon={<DownloadSimple size={24} weight="bold" />}
        label={t('actions.export')}
        size="mobile"
      />
      <ActionPillButton
        visible
        icon={<Plus size={24} weight="bold" />}
        label={t('actions.upload')}
        size="mobile"
      />
    </ActionPill>
  )
}
