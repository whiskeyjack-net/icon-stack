import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button, Toast } from '@whiskeyjack-net/design-system'
import { ArrowClockwise } from '@phosphor-icons/react'

/** How often an open tab asks for a newer worker; a tab can stay open for days. */
const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Offers the newer build once its service worker has installed. The worker
 * waits (`registerType: 'prompt'`), so the page keeps running the build it
 * loaded until the user reloads into the new one, never mid-task.
 */
export function UpdateToast() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {})
      }, UPDATE_CHECK_MS)
    },
  })

  return (
    <Toast
      open={needRefresh}
      // A closed Toast stays mounted to fade out, with its buttons still in the
      // tab order and the accessibility tree; `inert` takes them out of both.
      // React 18 has no typed prop for it, and passes an empty string through.
      {...(needRefresh ? {} : ({ inert: '' } as object))}
      icon={<ArrowClockwise size={16} weight="bold" className="text-[var(--color-accent-500)]" />}
      onDismiss={() => setNeedRefresh(false)}
      dismissLabel={t('update.later')}
      action={
        // Activates the waiting worker, which reloads the page once it controls it.
        <Button variant="accent" onClick={() => updateServiceWorker(true)}>
          {t('update.reload')}
        </Button>
      }
    >
      {t('update.ready')}
    </Toast>
  )
}
