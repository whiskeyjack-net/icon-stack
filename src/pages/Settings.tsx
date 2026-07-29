import { useTranslation } from 'react-i18next'
import { Card, CardContent, ToggleGroup, Select, useTheme } from '@whiskeyjack-net/design-system'
import { Sun, Moon, Desktop } from '@phosphor-icons/react'
import { activeLanguage, SUPPORTED_LANGUAGES } from '@/i18n'

// Endonyms: a language picker is read by someone who does not yet have the app
// in a language they read, so each option names itself.
const LANGUAGE_LABELS: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pt: 'Português',
  zh: '中文',
}

export function Settings() {
  const { t, i18n } = useTranslation()
  // Uncontrolled theme (same storageKey as the Layout): mode + setter come from
  // the hook, and every instance stays in sync.
  const { mode: theme, setMode: setTheme } = useTheme({ storageKey: 'icon-stack-theme' })

  const themeOptions = [
    { value: 'light' as const, label: t('settings.themeLight'), icon: <Sun size={20} /> },
    { value: 'dark' as const, label: t('settings.themeDark'), icon: <Moon size={20} /> },
    { value: 'system' as const, label: t('settings.themeSystem'), icon: <Desktop size={20} /> },
  ]

  return (
    // Same cap and insets as the Generator, so the header nav and the action
    // pill stay put as you move between the two pages.
    <div className="mx-auto max-w-[var(--content-max)] space-y-4 px-4 pb-6 pt-4">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
        {t('settings.title')}
      </h1>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {t('settings.theme')}
          </h2>
          <ToggleGroup options={themeOptions} value={theme} onChange={setTheme} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {t('settings.language')}
          </h2>
          <Select
            aria-label={t('settings.language')}
            value={activeLanguage(SUPPORTED_LANGUAGES)}
            onChange={(lng) => i18n.changeLanguage(lng)}
            options={SUPPORTED_LANGUAGES.map((code) => ({ value: code, label: LANGUAGE_LABELS[code] ?? code }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {t('settings.about')}
          </h2>
          <div className="space-y-2 text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
            <p className="flex justify-between gap-4">
              <span>{t('settings.version')}</span>
              {/* Injected from package.json at build time, so it cannot go stale
                  the way the retired app's hardcoded 1.0.0 did. */}
              <span className="font-mono tabular-nums">{__APP_VERSION__}</span>
            </p>
            <p className="border-t border-[var(--color-border-light)] pt-2 dark:border-[var(--color-border-dark)]">
              {t('settings.aboutText')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
