/**
 * Routing at the path the app is actually served from.
 *
 * `App.test.tsx` mounts each page directly inside `<Layout>`, bypassing
 * `<Routes>` entirely, so no test could see that the router never matched
 * anything in production. The app lives at whiskeyjack.net/icon-stack/, and a
 * `<BrowserRouter>` with no `basename` matches its routes against
 * `/icon-stack/` -- which is neither `/` nor `/settings`.
 *
 * The shell still paints, so the failure looks like a blank page rather than a
 * routing error, and following a nav link "fixes" it by moving to `/` at the
 * wrong URL. That is why it read as intermittent.
 *
 * These mount the real `App`, routes and all, at the deployed base.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'
import App from './App'

/** What Vite's BASE_URL resolves to in the deployed build. */
const BASE = '/icon-stack/'

function mountAt(path: string) {
  return render(
    <MemoryRouter basename={BASE} initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routing under the deployed base path', () => {
  it('renders the Generator at the base path itself', () => {
    mountAt(BASE)
    expect(screen.getByText(/drop a source image/i)).toBeInTheDocument()
  })

  it('renders Settings at its route under the base', () => {
    mountAt(`${BASE}settings`)
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
  })

  it('sends an unknown path back to the Generator rather than rendering nothing', () => {
    // Reachable without anyone typing a bad URL: the domain's shared 404 handler
    // stores the requested path and index.html replays it before React mounts,
    // so a stale entry restores a route this app has never had.
    mountAt(`${BASE}a-route-that-never-existed`)
    expect(screen.getByText(/drop a source image/i)).toBeInTheDocument()
  })

  /**
   * The tests above supply their own `basename`, so they prove the routes work
   * once the router has been told where it lives. They cannot prove that the
   * entry point tells it -- and that omission WAS the bug.
   *
   * `main.tsx` calls `createRoot`, so mounting it in a test is not the check.
   * Read it instead, the same way `PlatformSettings.test.ts` reads the settings
   * UI to prove every config field has a control.
   */
  it('hands the router a basename from the entry point, taken from BASE_URL', () => {
    const srcDir = dirname(fileURLToPath(import.meta.url))
    const main = readFileSync(join(srcDir, 'main.tsx'), 'utf8')
    const router = main.match(/<BrowserRouter[^>]*>/)?.[0] ?? ''

    expect(router).toMatch(/basename=/)
    // Derived rather than written out again: a second hardcoded copy of the
    // deploy path is one that drifts when the path moves.
    expect(router).toMatch(/import\.meta\.env\.BASE_URL/)
  })
})
