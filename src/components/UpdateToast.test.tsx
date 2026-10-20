import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import '@/i18n'

const updateServiceWorker = vi.fn(async () => {})
let waiting = false

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: useState(waiting),
    offlineReady: useState(false),
    updateServiceWorker,
  }),
}))

const { UpdateToast } = await import('./UpdateToast')

/** A closed toast stays mounted to fade out; it has to be inert while it is. */
const isInert = (name: string) => Boolean(screen.getByRole('button', { name }).closest('[inert]'))

describe('UpdateToast', () => {
  it('stays closed while no newer build is waiting', () => {
    waiting = false
    render(<UpdateToast />)
    expect(isInert('Reload')).toBe(true)
    expect(isInert('Later')).toBe(true)
  })

  it('reloads into the waiting build when asked, and only then', async () => {
    waiting = true
    const user = userEvent.setup()
    render(<UpdateToast />)

    expect(screen.getByText('A new version of Icon Stack is ready.')).toBeInTheDocument()
    expect(isInert('Reload')).toBe(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('can be put off without reloading', async () => {
    waiting = true
    updateServiceWorker.mockClear()
    const user = userEvent.setup()
    render(<UpdateToast />)

    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(isInert('Reload')).toBe(true)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })
})
