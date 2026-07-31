/**
 * The `define` block, in ONE place, because the app has two Vite configs.
 *
 * `vite.config.ts` covers dev and build; `vitest.config.ts` covers tests, and
 * `define` does not carry between them. A constant declared in only one of them
 * throws in the other, at MODULE scope, which takes down whole test files
 * rather than the one assertion that reads it. Adding `__APP_REPOSITORY__` to
 * vite.config.ts alone did exactly that to two suites.
 *
 * Both configs import this, so the failure mode is gone rather than documented.
 */
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export const appDefines = {
  // Settings' About card reads all three. Sourced from package.json rather than
  // typed into the component, which is how the retired app came to claim 1.0.0
  // forever. The version is the same number the core and CLI carry; see
  // RELEASING.md and scripts/sync-web-version.mjs.
  __APP_VERSION__: JSON.stringify(pkg.version),
  __APP_LICENSE__: JSON.stringify(pkg.license),
  // package.json carries the npm form (`git+https://….git`). Strip it back to
  // something a browser can open, since this one becomes an href.
  __APP_REPOSITORY__: JSON.stringify(
    pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, ''),
  ),
}
