import { type ReactNode, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AppShell,
  AppHeader,
  HeaderNav,
  AppMain,
  MobileBottomNav,
  useRouteFocus,
  useTheme,
  applyAccentForeground,
} from '@whiskeyjack-net/design-system'
import {
  WindowControlsLeft,
  WindowControlsRight,
  useSystemAccent,
  isLinuxDesktop,
} from '@whiskeyjack-net/tauri'
import { House, GearSix, List } from '@phosphor-icons/react'
import { GeneratorActions, GeneratorActionsMeasure } from './GeneratorActions'
import { useEffect } from 'react'

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  useRouteFocus(location.pathname, mainRef)

  // On Tauri desktop, match the OS accent + window-control layout (no-op on web).
  useSystemAccent()
  // Theme: uncontrolled (owns localStorage). The accent foreground is computed
  // once for the default/theme accent; useSystemAccent recomputes it on desktop.
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
  useEffect(() => { applyAccentForeground() }, [])

  const navItems = [
    { key: 'home', to: '/', label: t('nav.home'), Icon: House },
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

  return (
    <AppShell>
      {/* The DS AppHeader carries the Tauri window controls in its `chrome` slot
          and clears them via `tauri-pad-controls`; inert on the web. */}
      <AppHeader
        width="none"
        rowClassName="max-w-[800px] mx-auto w-full px-4 tauri-pad-controls"
        chrome={
          <>
            <div className="absolute left-4 top-0 h-16 flex items-center z-10">
              <WindowControlsLeft />
            </div>
            <div className="wc-right-container absolute right-4 top-0 h-16 flex items-center z-10">
              <WindowControlsRight />
            </div>
          </>
        }
      >
        <HeaderNav linkComponent={Link} items={items} />
        {/* Same actions as the mobile bar, same order -- only the size differs. */}
        <GeneratorActions size="desktop" />
      </AppHeader>

      <AppMain ref={mainRef} indicatorTopOffset={68} className="md:pt-16">
        <div className="max-w-[800px] mx-auto px-4 pt-3 pb-6">{children}</div>
      </AppMain>

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
    </AppShell>
  )
}
