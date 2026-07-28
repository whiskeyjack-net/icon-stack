import { useTranslation } from 'react-i18next'
import { Card, CardContent, ToggleGroup, Select, useTheme } from '@whiskeyjack-net/design-system'
import { Sun, Moon, Desktop } from '@phosphor-icons/react'
import { activeLanguage, SUPPORTED_LANGUAGES } from '@/i18n'

const LANGUAGE_LABELS: Record<string, string> = { en: 'English', es: 'Español' }

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
    <div className="space-y-4 pt-4">
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
    </div>
  )
}
