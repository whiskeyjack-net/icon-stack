/**
 * App-level smoke tests.
 *
 * These exist because two regressions shipped that no package-level test could
 * see: the Settings page lost its strings when a locale merge overwrote the
 * whole `settings` block, and the Generator rendered blank on first mount. Both
 * are the kind of fault that only shows up when the real tree is mounted.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'
import { GeneratorProvider } from '@/contexts/GeneratorContext'
import { Layout } from '@/components/Layout'
import { Generator } from '@/pages/Generator'
import { Settings } from '@/pages/Settings'

function mount(ui: React.ReactNode, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <GeneratorProvider>
        <Layout>{ui}</Layout>
      </GeneratorProvider>
    </MemoryRouter>,
  )
}

/**
 * A missing key renders as its own path, e.g. "generator.tagline". Checked on
 * every page rather than just Settings: an en.json rewrite once dropped the
 * whole `generator` block and every test still passed, because the only check
 * for raw keys was pointed at the page that happened to be fine.
 */
function expectNoRawKeys(container: HTMLElement) {
  expect(container.textContent ?? '').not.toMatch(
    /\b(app|nav|settings|platform|generator|source|preview|replace|actions|background)\.[a-zA-Z]/,
  )
}

describe('Generator', () => {
  it('renders its content on first mount', () => {
    mount(<Generator />)
    // The blank-page regression: everything below rendered only after a
    // route change away and back.
    expect(screen.getByRole('heading', { name: /icon stack/i })).toBeInTheDocument()
    expect(screen.getByText(/drop a source image/i)).toBeInTheDocument()
  })

  it('offers a way to pick a file without dragging', () => {
    mount(<Generator />)
    expect(screen.getByRole('button', { name: /choose a file/i })).toBeInTheDocument()
  })

  it('shows no platform tabs until a source exists', () => {
    mount(<Generator />)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('offers only the main source slot before one is loaded', () => {
    mount(<Generator />)
    // The alternate exists to give dark/mono variants different artwork, which
    // is meaningless with nothing to vary from.
    expect(screen.getByText(/drop a source image/i)).toBeInTheDocument()
    expect(screen.queryByText(/add an alternate/i)).not.toBeInTheDocument()
  })

  it('renders no untranslated keys anywhere', () => {
    const { container } = mount(<Generator />)
    expectNoRawKeys(container)
  })
})

describe('Settings', () => {
  it('labels the theme control', () => {
    mount(<Settings />, '/settings')
    // The i18n regression: these came out as raw keys, or blank, after the
    // `settings` block was overwritten by the platform strings.
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
    for (const label of ['Light', 'Dark', 'System']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
    }
  })

  it('labels the language control', () => {
    mount(<Settings />, '/settings')
    expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument()
  })

  it('shows the build version rather than a hardcoded one', () => {
    mount(<Settings />, '/settings')
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
    // Injected by both Vite configs from package.json. The retired app hardcoded
    // 1.0.0 in the component, which is why it stayed 1.0.0 forever.
    expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument()
  })

  it('renders no untranslated keys anywhere', () => {
    const { container } = mount(<Settings />, '/settings')
    expectNoRawKeys(container)
  })
})

describe('Layout', () => {
  it('exposes the primary action in the chrome', () => {
    mount(<Generator />)
    expect(screen.getAllByRole('link', { name: /generator/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /settings/i }).length).toBeGreaterThan(0)
    // The action pill lives in BOTH the desktop header and the mobile bottom
    // nav, so the primary action appears more than once in the tree.
    expect(screen.getAllByRole('button', { name: /export all icons/i }).length).toBeGreaterThan(1)
  })

  it('disables export until there is something to export', () => {
    mount(<Generator />)
    for (const button of screen.getAllByRole('button', { name: /export all icons/i })) {
      expect(button).toBeDisabled()
    }
  })

  it('keeps an upload action reachable from every page', () => {
    // The toolbar's picker lives in the Layout precisely so it survives a page
    // that has no source cards mounted.
    mount(<Settings />, '/settings')
    expect(
      screen.getAllByRole('button', { name: /upload a source image/i }).length,
    ).toBeGreaterThan(0)
  })

  it('collapses both panes to zero width with no source', () => {
    mount(<Generator />)
    // AppPanes keeps the hosts mounted so a page can fill them a render later;
    // an empty pane must not hold the column open and push content off-center.
    for (const aside of document.querySelectorAll('aside')) {
      expect(aside.parentElement).toHaveClass('w-0')
    }
  })

  it('survives a route change and back', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <GeneratorProvider>
          <Layout>
            <Generator />
          </Layout>
        </GeneratorProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText(/drop a source image/i)).toBeInTheDocument()

    rerender(
      <MemoryRouter initialEntries={['/settings']}>
        <GeneratorProvider>
          <Layout>
            <Settings />
          </Layout>
        </GeneratorProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument()
  })
})
