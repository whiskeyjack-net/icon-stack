import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, ToggleGroup, Toggle, Select, useTheme } from '@whiskeyjack-net/design-system'
import {
  Sun,
  Moon,
  Desktop,
  Copy,
  Check,
  GithubLogo,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { CompactIconButton } from '@/components/CompactIconButton'
import { useExtraDark } from '@/lib/use-extra-dark'
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
  const [extraDark, setExtraDark] = useExtraDark()

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
        <CardContent className="p-5 pt-3">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {t('settings.theme')}
          </h2>
          <ToggleGroup options={themeOptions} value={theme} onChange={setTheme} />
          {/* Extra dark (OLED) -- offered only where a dark theme can actually
              apply, so 'light' hides it and 'system' keeps it (it may resolve
              dark). Same rule as Chip Away, which is where the copy comes from. */}
          {theme !== 'light' && (
            <div className="mt-4 border-t border-[var(--color-border-light)] pt-4 dark:border-[var(--color-border-dark)]">
              <Toggle
                label={t('settings.extraDark.label')}
                description={t('settings.extraDark.description')}
                checked={extraDark}
                onChange={setExtraDark}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 pt-3">
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

      {/* The CLI is the same pipeline this page is a front end for -- the app and
          the CLI both call `generateIcons` from the core -- so the commands here
          produce byte-identical output to the Export button. Worth saying, because
          the reason to reach for it is a build script rather than a different
          feature set. */}
      <Card>
        <CardContent className="p-5 pt-3">
          <h2 className="mb-1 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {t('settings.cli')}
          </h2>
          <p className="mb-4 text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {t('settings.cliIntro')}
          </p>

          <div className="space-y-4">
            {CLI_EXAMPLES.map(({ key, command }) => (
              <div key={key}>
                <p className="mb-1.5 text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                  {t(`settings.cliExamples.${key}`)}
                </p>
                <Command text={command} />
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
            {t('settings.cliHelp')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 pt-3">
          <h2 className="mb-3 text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
            {t('settings.about')}
          </h2>
          <div className="space-y-2 text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
            {/* All three come from package.json at build time, so they cannot go
                stale the way the retired app's hardcoded 1.0.0 did. The version
                is the same number the core and the CLI carry -- one pipeline,
                one number (see RELEASING.md). */}
            <p className="flex justify-between gap-4">
              <span>{t('settings.version')}</span>
              <span className="font-mono tabular-nums">{__APP_VERSION__}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>{t('settings.license')}</span>
              <span className="font-mono">{__APP_LICENSE__}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>{t('settings.sourceCode')}</span>
              <a
                href={__APP_REPOSITORY__}
                target="_blank"
                rel="noopener noreferrer"
                className="wj-focus-ring inline-flex min-w-0 items-center gap-1.5 rounded font-medium text-[var(--color-text-secondary-light)] underline underline-offset-2 transition-colors hover:text-[var(--color-text-primary-light)] dark:text-[var(--color-text-secondary-dark)] dark:hover:text-[var(--color-text-primary-dark)]"
              >
                <GithubLogo size={14} weight="bold" aria-hidden />
                <span className="truncate">{REPO_LABEL}</span>
                <ArrowSquareOut size={12} className="shrink-0" aria-hidden />
              </a>
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

/**
 * `whiskeyjack-net/icon-stack` rather than the full URL: it is the half anyone
 * reads, and the row it sits in is narrow on a phone. Falls back to the whole
 * URL if the repository ever moves off GitHub, which is the right failure.
 */
const REPO_LABEL = __APP_REPOSITORY__.replace(/^https?:\/\/(www\.)?github\.com\//, '')

/**
 * The commands worth putting in front of someone, in the order they would meet
 * them: install, the common case, a subset, and the two flags that change the
 * output rather than the destination.
 */
const CLI_EXAMPLES = [
  { key: 'install', command: 'npx @whiskeyjack-net/icon-stack --help' },
  { key: 'generate', command: 'npx @whiskeyjack-net/icon-stack generate --source icon.png --out icons' },
  { key: 'subset', command: 'npx @whiskeyjack-net/icon-stack generate -s icon.svg -p pwa,favicon,windows' },
  { key: 'background', command: 'npx @whiskeyjack-net/icon-stack generate -s icon.png -b "#1E90FF" --corner-radius 20' },
] as const

/** A copyable command line. Selectable, wraps, and never truncates. */
function Command({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // A denied clipboard permission is not worth an error state -- the text is
      // selectable, which is the fallback either way.
    }
  }

  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--color-warm-100)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary-light)] dark:bg-[var(--color-neutral-800)] dark:text-[var(--color-text-primary-dark)]">
        {text}
      </code>
      <CompactIconButton
        label={copied ? t('settings.cliCopied') : t('settings.cliCopy')}
        icon={copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
        onClick={() => void copy()}
      />
    </div>
  )
}
