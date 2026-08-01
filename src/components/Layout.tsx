import { type ReactNode, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AppShell,
  AppHeader,
  AppMain,
  AppPanes,
  BottomDrawer,
  DrawerAction,
  HeaderNav,
  MobileBottomNav,
  applyAccentForeground,
  useRouteFocus,
  useTheme,
} from '@whiskeyjack-net/design-system'
import {
  WindowControlsLeft,
  WindowControlsRight,
  useSystemAccent,
  isLinuxDesktop,
} from '@whiskeyjack-net/tauri'
import { Stack, GearSix, List, X, Check } from '@phosphor-icons/react'
import { GeneratorActions, GeneratorActionsMeasure } from './GeneratorActions'
import { useGenerator } from '@/contexts/GeneratorContext'

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  useRouteFocus(location.pathname, mainRef)

  const { source, fileInputRef, requestFile, replacePending, confirmReplace, cancelReplace } =
    useGenerator()

  // On Tauri desktop, match the OS accent + window-control layout (no-op on web).
  useSystemAccent()
  // Theme: uncontrolled (owns localStorage). The accent foreground is computed
  // once for the theme accent; useSystemAccent recomputes it on desktop.
  useTheme({
    storageKey: 'icon-stack-theme',
    // Mirrors the RESOLVED appearance for index.html's pre-paint script, which
    // is what keeps the cold launch from flashing the wrong background. The
    // preference (`storageKey`) can be 'system'; the script needs the answer.
    launchMirrorKey: 'icon-stack-theme-resolved',
    // That pre-paint works by painting the root, whose background propagates to
    // the canvas -- which also overrides a transparent `body`. The Tauri Linux
    // window is undecorated + transparent with CSS-rounded corners, so painting
    // it there fills the corners and squares the window off.
    paintRoot: !isLinuxDesktop(),
  })
  useEffect(() => {
    applyAccentForeground()
  }, [])

  const navItems = [
    { key: 'generator', to: '/', label: t('nav.generator'), Icon: Stack },
    { key: 'settings', to: '/settings', label: t('nav.settings'), Icon: GearSix },
  ]
  const items = navItems.map(({ key, to, label, Icon }) => ({
    key,
    to,
    label,
    active: location.pathname === to,
    renderIcon: ({ active, size }: { active: boolean; size: number }) => (
      <Icon size={size} weight={active ? 'fill' : 'regular'} />
    ),
  }))

  // The side panes belong to the Generator, and only once there is something to
  // put in them. Settings and the empty state stay a single centered column, so
  // the header nav never shifts between pages.
  const panesActive = Boolean(source) && location.pathname === '/'

  return (
    <AppShell>
      {/* The one main-source picker. It lives here rather than beside the source
          cards because the toolbar has to reach it from every tab, and those
          cards are unmounted on a platform tab. Clearing `value` on change lets
          the same file be picked twice in a row. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/svg+xml,.svg"
        className="sr-only"
        aria-label={t('source.choose')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void requestFile('main', file)
        }}
      />

      {/* Full-width floating bar on every page: nav left, action pill right.
          Content scrolls behind it, so each pane below reserves its height and
          trades its native scrollbar for a bounded indicator. The Tauri window
          controls ride the `chrome` slot pinned to the window edges while the
          row clears them via tauri-pad-controls; all inert on the web. */}
      <AppHeader
        variant="floating"
        width="none"
        height={14}
        rowClassName="w-full px-4 wide:px-6 tauri-pad-controls"
        className="pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
        toolbar={<GeneratorActions size="desktop" />}
        chrome={
          <>
            <div className="absolute left-4 top-0 h-14 flex items-center z-10">
              <WindowControlsLeft />
            </div>
            <div className="wc-right-container absolute right-4 top-0 h-14 flex items-center z-10">
              <WindowControlsRight />
            </div>
          </>
        }
      >
        <HeaderNav linkComponent={Link} items={items} />
      </AppHeader>

      {/* Three phases, gated on the DS layout variants rather than plain widths,
          so a portrait tablet keeps the tabbed layout and a landscape one
          deploys the sidebar. The preview rail runs wider than Chip Away's nav
          rail -- icon previews at four sizes plus their captions need the room,
          and that extra width is the one place Icon Stack departs from Chip
          Away's proportions. railPaddingTop is 5.25rem against a 56px header
          (Chip Away's 5.5rem clears a 64px one), which puts the first rail card
          on the same line as the first content card. */}
      <AppPanes
        sidebar={{ filled: panesActive, 'aria-label': t('generator.platforms') }}
        rail={{
          filled: panesActive,
          width: 'w-[420px] 2xl:w-[460px]',
          'aria-label': t('generator.preview'),
        }}
        railPaddingTop="5.25rem"
        indicatorTopOffset={60}
      >
        <AppMain
          ref={mainRef}
          className="overscroll-none md:pt-14 wide:px-2"
          indicatorTopOffset={60}
        >
          {children}
        </AppMain>
      </AppPanes>

      <MobileBottomNav
        linkComponent={Link}
        menuIcon={<List size={24} weight="regular" />}
        menuLabel={t('nav.menu')}
        navItems={items}
        toolbar={<GeneratorActions size="mobile" />}
        // Worst case (every action visible) so the collapse decision does not
        // flip as the contextual buttons appear and disappear.
        measureToolbar={<GeneratorActionsMeasure />}
      />

      {/* Replacing the source throws away every per-platform setting tuned
          against it, so it asks first. Raised from the context, so one drawer
          covers the toolbar, the source card, and a drag-and-drop alike. */}
      <BottomDrawer
        open={replacePending !== null}
        onClose={cancelReplace}
        title={t('replace.title')}
        footer={
          <>
            <DrawerAction icon={<X />} label={t('replace.cancel')} onClick={cancelReplace} />
            <DrawerAction
              icon={<Check />}
              label={t('replace.confirm')}
              onClick={() => void confirmReplace()}
            />
          </>
        }
      >
        <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
          {t('replace.body', { fileName: replacePending?.name ?? '' })}
        </p>
      </BottomDrawer>
    </AppShell>
  )
}
