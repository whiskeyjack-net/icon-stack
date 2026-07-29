import { useTranslation } from 'react-i18next'
import {
  ActionPill,
  ActionPillButton,
  ActionPillStaticButton,
} from '@whiskeyjack-net/design-system'
import { DownloadSimple, UploadSimple, Trash } from '@phosphor-icons/react'
import { useGenerator } from '@/contexts/GeneratorContext'

/**
 * The app's toolbar actions, for the desktop header and the mobile bottom nav.
 *
 * Same buttons in the same order on both, per the design system's rule -- only
 * `size` differs. Export is the primary action and always present; the
 * contextual ones collapse away until a source exists, which is what
 * `ActionPillButton`'s `visible` is for.
 */
export function GeneratorActions({ size }: { size: 'desktop' | 'mobile' }) {
  const { t } = useTranslation()
  const { source, platforms, busy, generate, setSlot, triggerUpload } = useGenerator()

  const hasSource = Boolean(source)
  const enabledCount = Object.values(platforms).filter((p) => p.enabled).length
  const canExport = hasSource && enabledCount > 0 && !busy

  return (
    <ActionPill size={size} variant="accent">
      <ActionPillButton
        visible={hasSource}
        icon={<Trash size={size === 'mobile' ? 22 : 18} weight="bold" />}
        label={t('actions.clear')}
        onClick={() => {
          setSlot('alternate', null)
          setSlot('main', null)
        }}
      />
      <ActionPillStaticButton
        icon={<UploadSimple size={size === 'mobile' ? 22 : 18} weight="bold" />}
        label={hasSource ? t('actions.replace') : t('actions.upload')}
        onClick={triggerUpload}
      />
      <ActionPillStaticButton
        icon={<DownloadSimple size={size === 'mobile' ? 22 : 18} weight="bold" />}
        label={t('actions.export')}
        disabled={!canExport}
        onClick={() => void generate('all')}
      />
    </ActionPill>
  )
}

/**
 * Worst-case copy for MobileBottomNav's overflow measurement: every action
 * visible, so the collapse decision stays stable instead of flipping as the
 * contextual buttons appear.
 */
export function GeneratorActionsMeasure() {
  const { t } = useTranslation()
  return (
    <ActionPill size="mobile" variant="accent">
      <ActionPillButton visible icon={<Trash size={22} weight="bold" />} label={t('actions.clear')} />
      <ActionPillStaticButton icon={<UploadSimple size={22} weight="bold" />} label={t('actions.replace')} />
      <ActionPillStaticButton icon={<DownloadSimple size={22} weight="bold" />} label={t('actions.export')} />
    </ActionPill>
  )
}
