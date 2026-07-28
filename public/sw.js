/**
 * Tombstone service worker.
 *
 * Icon Stack used to be a PWA (vite-plugin-pwa, registerType: 'autoUpdate').
 * The rebuilt app is not, and registers no service worker -- but a worker
 * already installed on a device keeps running and keeps intercepting every
 * request under /icon-stack/, serving its precache. The symptom is a page that
 * looks empty on load and only fills in after a client-side navigation.
 *
 * Deleting sw.js is not enough: browsers only re-check the script on their own
 * schedule, and behavior on a 404 varies. Serving a worker that unregisters
 * itself is the reliable way to retire one. Browsers fetch this on their next
 * update check, it takes control, drops every cache, unregisters, and reloads
 * open clients onto the real network responses.
 *
 * Keep this file until it is safe to assume no device still holds the old
 * worker. Removing it early leaves those devices stuck on a 2026-era precache.
 */
self.addEventListener('install', () => {
  // Replace the outgoing worker immediately rather than waiting for every tab
  // to close -- the whole point is to stop serving stale responses now.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.map((name) => caches.delete(name)))
      await self.registration.unregister()

      // Reload anything currently open so it re-fetches from the network.
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) client.navigate(client.url)
    })(),
  )
})

// Never answer a request from cache while winding down.
self.addEventListener('fetch', () => {})
