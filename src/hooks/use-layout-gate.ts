import { useEffect, useState } from 'react'

/**
 * TEMPORARY local mirror of the design system's `useLayoutGate`.
 *
 * The hook and its `LAYOUT_GATES` constant landed in the DS for exactly this
 * consumer, but they ship in 0.8.0 -- this app is pinned to the published
 * 0.7.0. Swap the two imports below for
 * `import { useLayoutGate } from '@whiskeyjack-net/design-system'` and delete
 * this file the moment 0.8.0 is on npm; the signature is identical so nothing
 * else changes.
 *
 * Keeping the queries verbatim matters more than it looks: the gates are
 * pointer- and orientation-aware, so the obvious `matchMedia('(min-width:
 * 1280px)')` would disagree with the CSS on a landscape tablet -- the app would
 * portal the preview into a rail that is still hidden, or leave it inline
 * beside a rail that has already deployed.
 */
export type LayoutGate = 'wide' | 'xlwide'

export const LAYOUT_GATES: Record<LayoutGate, string> = {
  wide: '(min-width: 768px) and (pointer: coarse) and (orientation: landscape), (min-width: 1024px) and (pointer: fine)',
  xlwide:
    '(min-width: 1280px) and (pointer: coarse) and (orientation: landscape), (min-width: 1280px) and (pointer: fine)',
}

export function useLayoutGate(gate: LayoutGate): boolean {
  const query = LAYOUT_GATES[gate]
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}
