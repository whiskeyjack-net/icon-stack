import { useState } from 'react'

/** Test stand-in for `virtual:pwa-register/react`: no worker, nothing waiting. */
export function useRegisterSW() {
  const needRefresh = useState(false)
  const offlineReady = useState(false)
  return { needRefresh, offlineReady, updateServiceWorker: async () => {} }
}
