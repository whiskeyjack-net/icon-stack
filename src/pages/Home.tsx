import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  ButtonRow,
  Notice,
  ProgressBar,
  TabBar,
  Toggle,
  cn,
  useSwipeNavigation,
} from '@whiskeyjack-net/design-system'
import { DownloadSimple, Package } from '@phosphor-icons/react'
import { PLATFORM_LABELS, type Platform } from '@whiskeyjack-net/icon-stack-core'
import { useGenerator, PLATFORMS } from '@/contexts/GeneratorContext'
import { SourceSlots } from '@/components/SourceSlots'
import { PlatformSettings } from '@/components/PlatformSettings'
import { SizePreview } from '@/components/SizePreview'

export function Home() {
  const { t } = useTranslation()
  const {
    source,
    platforms,
    selected,
    setSelected,
    togglePlatform,
    generate,
    busy,
    exporting,
    progress,
    error,
  } = useGenerator()

  const activeIndex = PLATFORMS.indexOf(selected)
  // A TabBar is always paired with swipe navigation, so the content moves the
  // same way the tabs do.
  const { swipeOffset, isAnimating, handleTouchStart, handleTouchMove, handleTouchEnd } =
    useSwipeNavigation({
      count: PLATFORMS.length,
      activeIndex,
      onNavigate: (index) => setSelected(PLATFORMS[index]),
    })

  const enabledCount = PLATFORMS.filter((p) => platforms[p].enabled).length

  return (
    <div className="space-y-6">
      <header className="pt-4">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
          {t('home.title')}
        </h1>
        <p className="mt-1 text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
          {t('home.subtitle')}
        </p>
      </header>

      <SourceSlots />

      {error && <Notice tone="error">{error}</Notice>}

      {source && (
        <>
          {/* Export the whole selection -- what most people came for. */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-border-light)] p-4 dark:border-[var(--color-border-dark)]">
            <div className="flex items-center gap-3">
              <Package size={24} weight="duotone" className="text-[var(--color-accent-500)]" />
              <div>
                <p className="font-medium text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
                  {t('home.exportAll')}
                </p>
                <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                  {t('home.platformsSelected', { count: enabledCount })}
                </p>
              </div>
            </div>
            <Button
              variant="accent"
              disabled={busy || enabledCount === 0}
              onClick={() => void generate('all')}
            >
              <DownloadSimple size={16} weight="bold" className="mr-1.5" />
              {exporting === 'all' ? t('home.generating') : t('home.exportAllAction')}
            </Button>
          </div>

          {busy && <ProgressBar value={progress / 100} label={t('home.generating')} />}

          <TabBar
            items={PLATFORMS.map((id) => ({ id, label: PLATFORM_LABELS[id] }))}
            activeId={selected}
            onSelect={(id) => setSelected(id as Platform)}
          />

          {/* Viewport-sized wrapper: a content-height one silently swallows
              swipes below short content. */}
          <div
            className="min-h-[calc(100dvh-24rem)] touch-pan-y md:min-h-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              style={{ transform: `translateX(${swipeOffset}px)` }}
              className={cn('space-y-6', isAnimating && 'transition-transform duration-200')}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
                    {PLATFORM_LABELS[selected]}
                  </h2>
                  <Badge tone={platforms[selected].enabled ? 'success' : 'neutral'}>
                    {platforms[selected].enabled ? t('home.included') : t('home.excluded')}
                  </Badge>
                </div>
                <Toggle
                  aria-label={t('home.includePlatform')}
                  checked={platforms[selected].enabled}
                  onChange={() => togglePlatform(selected)}
                />
              </div>

              <SizePreview platform={selected} />

              <PlatformSettings platform={selected} />

              <ButtonRow>
                <Button variant="outline" disabled={busy} onClick={() => void generate(selected)}>
                  <DownloadSimple size={16} weight="bold" className="mr-1.5" />
                  {exporting === selected
                    ? t('home.generating')
                    : t('home.exportOne', { platform: PLATFORM_LABELS[selected] })}
                </Button>
              </ButtonRow>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
