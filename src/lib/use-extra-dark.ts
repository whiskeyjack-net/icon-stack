import { useCallback, useEffect, useState } from 'react'

/**
 * Persistence for the OLED overlay.
 *
 * The DS `useTheme` OWNS the light/dark preference in uncontrolled mode
 * (`storageKey`), and it ACCEPTS `extraDark` as a plain prop without persisting
 * it -- reasonably, since Chip Away keeps the flag in a Dexie settings row and
 * passes it in. An app with no database of its own therefore has to store the
 * boolean itself, which is what this is.
 *
 * The sync is deliberately the same shape as the hook's own: a custom event for
 * other instances in this tab (Layout applies the class, Settings sets it, and
 * they must agree without a shared parent) plus `storage` for other tabs.
 *
 * DS finding: uncontrolled `useTheme` could own this the way it owns `mode`.
 * Every uncontrolled consumer will otherwise rewrite these thirty lines.
 */
const KEY = 'icon-stack-extra-dark'
const CHANGE_EVENT = 'icon-stack-extra-dark-changed'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // Locked-down webviews throw on storage access; the overlay is off by default.
    return false
  }
}

export function useExtraDark(): [boolean, (next: boolean) => void] {
  const [extraDark, setValue] = useState(() => (typeof window === 'undefined' ? false : read()))

  useEffect(() => {
    const sync = () => setValue(read())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setExtraDark = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      // The in-memory state still updates; persistence is best-effort.
    }
    setValue(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return [extraDark, setExtraDark]
}
