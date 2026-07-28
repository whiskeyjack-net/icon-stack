/**
 * App-level smoke tests.
 *
 * These exist because two regressions shipped that no package-level test could
 * see: the Settings page lost its strings when a locale merge overwrote the
 * whole `settings` block, and the Home page rendered blank on first mount. Both
 * are the kind of fault that only shows up when the real tree is mounted.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'
import { GeneratorProvider } from '@/contexts/GeneratorContext'
import { Layout } from '@/components/Layout'
import { Home } from '@/pages/Home'
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

describe('Home', () => {
  it('renders its content on first mount', () => {
    mount(<Home />)
    // The blank-page regression: everything below rendered only after a
    // route change away and back.
    expect(screen.getByRole('heading', { name: /icon stack/i })).toBeInTheDocument()
    expect(screen.getByText(/drop a source image/i)).toBeInTheDocument()
  })

  it('offers a way to pick a file without dragging', () => {
    mount(<Home />)
    expect(screen.getByRole('button', { name: /choose a file/i })).toBeInTheDocument()
  })

  it('shows no platform tabs until a source exists', () => {
    mount(<Home />)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
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

  it('renders no untranslated keys anywhere', () => {
    const { container } = mount(<Settings />, '/settings')
    // A missing key renders as its own path, e.g. "settings.themeLight".
    expect(container.textContent ?? '').not.toMatch(/\b(settings|platform|home|source)\.[a-zA-Z]/)
  })
})

describe('Layout', () => {
  it('exposes the primary action in the chrome', () => {
    mount(<Home />)
    expect(screen.getAllByRole('link', { name: /home/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /settings/i }).length).toBeGreaterThan(0)
    // The action pill lives in BOTH the desktop header and the mobile bottom
    // nav, so the primary action appears more than once in the tree.
    expect(screen.getAllByRole('button', { name: /export all icons/i }).length).toBeGreaterThan(1)
  })

  it('disables export until there is something to export', () => {
    mount(<Home />)
    for (const button of screen.getAllByRole('button', { name: /export all icons/i })) {
      expect(button).toBeDisabled()
    }
  })

  it('survives a route change and back', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <GeneratorProvider>
          <Layout>
            <Home />
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
