# Findings: building on the published packages

Icon Stack is deliberately built **outside** the Whiskeyjack monorepo, consuming
`@whiskeyjack-net/design-system`, `@whiskeyjack-net/i18n` and the
`create-whiskeyjack` starter exactly as any third party would. Chip Away stays
inside the monorepo on workspace source. The two together are the control and
the experiment: anything that works in one and not the other is a packaging or
documentation gap, and it lands here.

This file is the point of the exercise. Every entry is something a real external
consumer hits.

Status legend: **OPEN** needs a change upstream · **RESOLVED** upstream fix
shipped and consumed here · **FIXED HERE** handled locally, upstream change
still wanted · **PASS** worked as advertised · **WITHDRAWN** recorded, then
found to be wrong.

**Round trip so far:** findings raised across five stages and fixed upstream in
`design-system@0.6.0`–`0.8.0` and `create-whiskeyjack@0.3.1`, published, and
consumed back here. One withdrawn as incorrect, one overstated and corrected. Three open.

---

## Stage A – scaffold, shell, first generation flow

### PASS – the starter kit works end to end, unassisted

`npm create whiskeyjack@latest icon-stack` → `npm install` → `npm run lint` →
`npm run build` was green with **zero manual fixes**. Name substitution was
complete (no `__APP_NAME__` left anywhere), `components.json` shipped pointing at
the live registry, `AGENTS.md` and the ESLint flat config came through, and the
app shell rendered on the published design system.

### PASS – the published design system surface matches its documentation

62 runtime exports from `@whiskeyjack-net/design-system@0.5.0`, matching
`components.manifest.json` exactly. Tokens, Tailwind preset, utilities CSS and
theming all resolved from the package with no component copying.

---

### RESOLVED – a package that exports raw TS source imposes its type problems on consumers

**The most significant finding so far.** `@whiskeyjack-net/icon-stack-core` uses
`main: ./src/index.ts`, so a consumer's `tsc` compiles the package's *source*
under the *consumer's* tsconfig. Three separate failures came out of that, none
of which appear inside the monorepo:

1. **`pica` has no type declarations.** The browser adapter imports it, so the
   consumer gets `TS7016: Could not find a declaration file for module 'pica'`
   even though the consumer never touches pica.
2. **Ambient declarations do not travel.** Adding `packages/core/src/pica.d.ts`
   did nothing until the root tsconfig `include` was widened, because a `.d.ts`
   only applies when it is part of the program.
3. **Widening `include` then compiled files the app never imports** – the Node
   adapter, which needs `@types/node` for `Buffer`, in a browser app that only
   ever imports `/browser`.

Each fix exposed the next. Final local shape: `include: ["src",
"packages/core/src"]`, `exclude: [..., "packages/core/src/adapters/node.ts"]`,
plus a hand-written `pica.d.ts`.

**Fixed** – `packages/core` now builds with tsup (`dts: true`) and exports
`dist/*.js` + `dist/*.d.ts` from three entry points, keeping the two adapters
separable so the browser bundle never pulls in `@napi-rs/canvas` (verified: zero
occurrences of it, resvg, or `node:fs` in the web bundle).

All three workarounds are gone. The app's tsconfig is back to `include: ["src"]`
with no `exclude` beyond build output, and it no longer reaches into a
dependency's internals. The `pica.d.ts` shim stayed – it always belonged to the
package that depends on pica; the build simply stopped it being *the consumer's*
problem. Deleting it was in fact the one wrong move, and it broke the core's own
declaration build immediately.

Cost: the app consumes `dist`, so the core must build first. `build`, `dev` and
`test` now do that explicitly, because npm does not order workspace builds
topologically.

**Still applies to any future package here:** export built output, never `src`.

---

### RESOLVED – `EmptyState`'s CTA is a label and a handler, not a slot

```ts
ctaLabel?: string
onCta?: () => void
```

So the CTA cannot carry an icon, cannot use a non-accent `Button` variant, and
cannot be a `<label>` wrapping a file input – all reasonable things for an empty
state whose entire purpose is "start here". The drop zone wanted an upload icon
on the button and had to drop it.

**Fixed in design-system 0.6.0** – `action?: ReactNode` renders in place of the
shorthand and takes precedence when both are given. The drop zone now has its
upload icon.

### RESOLVED – generated component docs describe behavior but never list props

`docs/empty-state.md` ships in the package and says "optional call to action",
which is what led to guessing `action`. It never names `ctaLabel`/`onCta`. The
`.d.ts` is currently the only place a consumer can learn a component's actual
API.

**Fixed in design-system 0.6.0** – every page now carries a props table built
from the emitted declarations, **including CVA variants**. That last part
mattered more than the interface: `Badge` and `ActionPill` declare *empty*
`Props` interfaces and keep their whole API in `VariantProps`, so an
interface-only reader produced no table at all for the component whose `tone`
prop is its entire API.

---

### RESOLVED – the starter assumes Tauri, and a pure-web app pays for it

The template hard-depends on `@whiskeyjack-net/tauri` and wires window controls
into the shell. Icon Stack is pure web and always will be. The dependency is
inert at runtime, but it is a **15.3 kB** `window-*.js` chunk in a build that
will never use it, plus a dependency to keep updated.

**Fixed in create-whiskeyjack 0.3.1** – the template README names the exact
touchpoints. Icon Stack has not removed it yet; the shell still uses the Tauri
window-control slots, and a decision on going desktop can come later.

### RESOLVED – the starter scaffolds a single package, with no path to workspaces

Icon Stack needs `packages/core` and `packages/cli` beside the app. Converting
the scaffold to npm workspaces was entirely manual: adding `workspaces`, moving
`test`/`typecheck` to `--workspaces --if-present`, and reconciling the app's
DOM-targeted tsconfig with the CLI's Node-targeted one.

**Fixed in create-whiskeyjack 0.3.1** – the README covers converting to npm
workspaces, and carries the non-obvious part: a package exporting raw TypeScript
compiles under the consumer's tsconfig.

---

### WITHDRAWN – "the published packages ship no LICENSE"

Recorded here initially and **it was wrong**. Checked against the actual
tarballs: `@whiskeyjack-net/design-system`, `i18n` and `tauri` all ship
`package/LICENSE`, and all four stage scripts copy it.

What genuinely lacked a LICENSE were `icon-stack-core` and `icon-stack-cli` --
packages created during the extraction and never published. That was an
omission in new work, not a gap in the published set. Both carry one here.

Left in place rather than deleted, because a findings file that quietly drops
its mistakes is not one anybody should trust.

### RESOLVED – lint had never run over this code, or over the monorepo

`prefer-const` on `generate.ts:375` and a stale `eslint-disable` in
`browser.ts` were both latent in the monorepo, because **every monorepo app
declares a `lint` script and none had an `eslint.config.js`** – no config had ever
existed anywhere in that repo's history, so all eight scripts exited 2 without
reading a line. The starter's flat config caught both within a minute of the code
arriving here.

**The monorepo adopted the same config.** Turning it on there found 41 problems
across 373 files, including two `eslint-disable` directives suppressing nothing –
which nobody could have known, because no config had ever run to tell them – and
a `useMemo` that re-sorted on every render because its dependency array was
rebuilt each time.

Worth stating as the general lesson, since it is the whole reason this repo
exists: the starter kit found a defect in the monorepo that defines the starter
kit. The two configs are now pinned against each other by
`scripts/check-lint-parity.mjs` upstream, so the rules a stranger is held to and
the rules the reference implementation is held to cannot drift.

### FIXED HERE – `new Blob([bytes])` fails under current TypeScript lib types

`generateIcons` returns `Uint8Array`, and `new Blob([zip])` errors with
`SharedArrayBuffer is not assignable to ArrayBuffer` because `Uint8Array` is now
generic over its backing buffer. Cast at the call site for now.

**Upstream fix:** worth a note in the core's README, since every browser consumer
downloading the result hits it.

---

### OPEN – `./package.json` is not in the design system's `exports` map

`require('@whiskeyjack-net/design-system/package.json')` throws
`ERR_PACKAGE_PATH_NOT_EXPORTED`. Reading a dependency's manifest is routine –
version checks, build tooling, bundler plugins – and an `exports` map silently
forbids it unless the path is listed.

**Upstream fix:** add `"./package.json": "./package.json"` to the exports map.
Done in `icon-stack-core` already; costs nothing and removes a papercut.

### OPEN – a caret on a `0.x` version pins the MINOR, and three places depend on it

The 0.6.0 release left two ranges stale, both silently: the starter template
pinned `design-system ^0.5.0`, so every scaffolded app installed 0.5.0 and did
not get the `action` slot added for this very consumer; and published
`tauri@0.3.1` peered on `^0.5.0`, which 0.6.0 cannot satisfy.

`^0.5.0` means `>=0.5.0 <0.6.0`. Nothing catches this automatically –
`onlyUpdatePeerDependentsWhenOutOfRange` deliberately stops a DS bump cascading,
which also means nothing bumps these when the range genuinely does go out of
date. There are now **three** such places: tauri's `WJ_PUBLIC_PEERS`, the starter
template's deps, and this repo's.

**Upstream fix:** a release-time check that every declared Whiskeyjack range
still admits the version about to ship. Both instances were fixed by hand in
`tauri@0.3.2` / `create-whiskeyjack@0.3.1`, which is exactly the manual step
worth automating before 0.7.0.

---

## Stage B – component-heavy screens

### PASS – the props tables work, and paid for themselves immediately

The entire background editor was written from `docs/color-input.md` alone,
without opening the `.d.ts` or the source: `value`, `onChange`, `aria-label`,
`showHex`, `size`, `icon`, `unset`, `selected`, all correct first time. Same for
`Toggle`, `ToggleGroup` and `Slider`. This is the difference the 0.6.0 tables
made -- Stage A had to read declarations to learn `EmptyState`'s API.

### FOUND AND FIXED UPSTREAM – quoted property names vanished from those tables

Using the tables is also what caught a defect in them. `ColorInput`'s `showHex`
carried a description about accessible labels, and there was no `aria-label`
row at all -- a **required** prop, missing.

The 0.6.0 generator matched member names with `\w+`, which matches neither a
quote nor a hyphen, so `"aria-label": string` was skipped; and because it
skipped the member but not its preceding JSDoc, that comment leaked onto the
next prop. `ColorInput`, `Toggle` and `DrawerAction` were all affected.

**Fixed in design-system 0.6.1.** Worth noting the shape of it: a *wrong* table
was noticed within minutes of use, where a *missing* one had gone unremarked
since the package first shipped.

### OPEN – a Slider's essential props are invisible in its table

`min`, `max` and `step` do not appear in `docs/slider.md`, because `SliderProps`
extends `React.InputHTMLAttributes` and they arrive through inheritance. The
table lists only `label`, `value`, `onChange`, `formatValue` -- everything that
makes a slider a *range* is left to a footnote saying HTML attributes are
extended.

Harmless once you know; puzzling if you do not. Worth either surfacing the
handful of inherited props that are genuinely part of a component's API, or
naming them in the `docs` prose.

### RESOLVED – writing to `PlatformConfigs[key]` requires the intersection of every config

`platforms[key] = { ...next }` where `key: Platform` fails: TypeScript requires
the value to satisfy the *intersection* of `AppleConfig & AndroidConfig &
PwaConfig & ...`, which no single config satisfies. A computed key in an object
literal (`{ ...prev, [key]: next }`) widens and is fine; a loop assignment is
not. Worked around with `Object.assign`, which mutates rather than reassigns.

**Fixed in the core** – `updatePlatform<K extends Platform>(configs, platform,
patch)` pins the key to one platform, so the patch is checked against that
platform's own type and nothing else. `selectPlatforms(configs, enabled)` covers
"generate only what is selected" while preserving every other setting.

`selectPlatforms` hits the same union problem internally and carries the single
assertion needed to resolve it -- which is the point: absorb it once rather than
in every consumer. Ten tests cover both, including that a platform-specific
field like Android's `useMonochrome` type-checks through the generic.

---

## Stage C – layout parity with the monorepo build

Stage C set this app's layout against the Chip Away original it was modelled on,
across all four phases (narrow, regular, wide, extra-wide). The rebuild had
shipped as a single centred column at every width, so almost everything below is
about the side-by-side presentation.

### RESOLVED – the three-pane layout was 250 lines copied between two apps

Chip Away and the retired monorepo Icon Stack had grown near-identical
sidebar/rail columns: same collapse-don't-unmount portal hosts, same hidden
native scrollbar plus bounded `ScrollIndicator`, same `pt` clearing the floating
header. The Icon Stack copy's own comments said "mirrors Chip Away's". Rebuilding
it a third time here would have made three.

**Extracted to `AppPanes` in design-system 0.7.0.** `sidebar` / `rail` take an
`AppPaneConfig` (`filled`, optional `width`, `aria-label`), and pages read
`useSidebarHost()` / `useRailHost()` and portal into them. Eight tests, the
load-bearing one pinning that an unfilled pane **collapses to `w-0` rather than
unmounting** -- unmounting produces a null host on exactly the render that
needed it, which is the bug both hand-rolled copies had already been written to
avoid without saying so.

Icon Stack passes `width: 'w-[420px] 2xl:w-[460px]'` for the preview rail. That
override existing is the reason the extraction works: the rail is genuinely
wider here than Chip Away's nav rail, and a component that hard-coded one set of
proportions would have been rejected by its second consumer.

### RESOLVED – the layout gates existed only in CSS

`wide` and `xlwide` are pointer- and orientation-aware, not width breakpoints:
`(min-width: 768px) and (pointer: coarse) and (orientation: landscape),
(min-width: 1024px) and (pointer: fine)`. They lived only inside
`tailwind-preset.js`.

Everything on this page decides layout in CSS, which is correct and free. One
thing cannot: the live preview runs the **real** icon pipeline, so rendering it
inline and in the rail with one hidden would regenerate every icon twice on
every slider tick. It has to be mounted once, in one place or the other, which
means reading the gate in JS.

The obvious `matchMedia('(min-width: 1280px)')` is wrong, and wrong *quietly* --
it disagrees with the CSS on a landscape tablet, portaling the preview into a
rail that has not deployed. The retired monorepo app did exactly this.

**Added `useLayoutGate` + `LAYOUT_GATES` in design-system 0.8.0**, published and
consumed here. The queries are declared twice by necessity -- Tailwind loads the
preset as a config module with no TypeScript transform, and the published package
ships no `src/` for it to read, while the hook ships as a self-contained registry
item and so cannot import a package-root file. A test pins both declarations
against the variants the preset actually registers, so the two cannot drift
silently.

The publishing gap was bridged by a clearly-labelled local mirror
(`src/hooks/use-layout-gate.ts`) carrying the same signature and a
delete-on-publish note, so adopting the real hook was a one-line import change
and a `rm`. Worth keeping as the pattern: this app is *always* one publish behind
a fix it asked for, and a mirror that advertises its own expiry beats either
waiting or quietly diverging.

One thing the round trip surfaced that the local mirror could not: the published
`tailwind-preset.js` now imports `layout-gates.js`, and the published package
ships no `src/`, so that file had to be added to the staged tarball by hand.
Verified in the published artifact rather than the workspace -- exactly the class
of defect this repo exists to catch.

### RESOLVED – no scaffolded project can type-check `import.meta.env`

`create-whiskeyjack`'s template ships no `src/vite-env.d.ts`, so the first use of
`import.meta.env.BASE_URL` fails with `Property 'env' does not exist on type
'ImportMeta'`. Vite's own `create-vite` scaffold includes this file; ours dropped
it. One line, and every generated project needs it.

**Fixed in the template**, and added here.

### FIXED HERE – the app's own test suite never ran

`npm test` was `npm run test --workspaces --if-present`, which runs the two
packages and skips the app, whose vitest config lives at the repo root. CI ran
`npm test` and went green without ever executing `src/App.test.tsx`. Now
`vitest run && npm run test --workspaces`.

Worth recording as a shape rather than a typo: the app *had* tests, they *were*
wired to a config, and nothing anywhere reported that they were not running. A
"tests exist" check is not a "tests run" check.

### FIXED HERE – an `en.json` rewrite dropped a whole block and every test passed

Re-keying `home.*` to `generator.*` left English pointing at the old block while
Spanish got the new one. All thirteen smoke tests stayed green: the only
untranslated-key assertion was pointed at Settings, which was untouched.

The check is now a shared helper applied to every page, matching every top-level
namespace. A raw-key assertion is only worth what it covers.

### RESOLVED – the multi-select tile grid was hand-rolled in two apps

`ToggleGroup` owned the single-select version of the recipe (bordered tile, accent
fill when chosen) and was a `radiogroup` by construction, so a multi-select grid
could not use it. The real count turned out to be worse than "two apps": **sixteen
copies across five app files**, plus `ToggleGroup` itself.

**Fixed in design-system 0.9.0** -- `CheckboxGroup` for pick-any, and
`optionTileClass` holding the tile both group components now draw from, so a
pick-one and a pick-any control cannot drift apart. A DS test renders both and
asserts the selected tile carries the same classes.

Icon Stack's `PlatformGrid` is that component's **first external consumer** and is
now nine lines of configuration. The one thing worth passing back: a multi-select
control hands back the whole set rather than a delta, so the app needed a
`setEnabledPlatforms` that reconciles every platform in one pass -- `togglePlatform`
per changed item would have been the wrong shape.

## Stage D – the things the rebuild quietly dropped

### FIXED HERE – six locales came back, and a test now guards all eight

The monorepo app shipped 8 locales; the rebuild launched with 2. That reads as a
deliberate scope choice until you check, which is exactly why it survived a
review.

de, fr, it, ja, pt and zh are restored. 26 of the 88 keys had a human translation
in the retired locale files under a different key path, matched by English value
rather than by key, so the established terminology carried over -- de
"Maskierbarer Zoom", fr "masquable", ja "マスカブル" -- instead of being reinvented
one file at a time.

`src/i18n/locales.test.ts` now pins what no type check can see: identical key sets
across all eight, `{{placeholder}}` survival per key, no empty values, and the
em-dash ban. It also asserts the *count* is at least 8 and that every file on disk
is registered in the i18n bootstrap -- a locale file nobody imports is dead weight
that looks like support.

It caught something immediately: the Chinese `alternateHint` used `——`, which is
correct Chinese punctuation and a violation of the repo-wide em-dash rule. The
sentence was restructured into two clauses rather than the rule exempted, because
one uniform ban is worth more than a per-language carve-out.

### FIXED HERE – the PWA is back, at a different service-worker filename

The app had icon assets and a PWA in the monorepo and neither survived the
rebuild: `public/` held only the tombstone service worker. Icons and the head
links came back first, making it installable; this closes the offline half.

**The filename is the finding.** `vite-plugin-pwa` writes `sw.js` by default,
which is exactly the path the tombstone occupies -- and the tombstone exists
because a stale precache *at that path* is what made the rebuilt app render blank
until you navigated away and back. Publishing a real worker there would hand any
device still holding the retired registration a straight old-SW → new-SW upgrade,
skipping the cleanup the tombstone exists to perform.

`filename: 'service-worker.js'` removes the collision entirely: an old device
still fetches the tombstone, unregisters, and only then does the page register
the real worker. The tombstone can be deleted later without touching it.

Two things only visible by reading the build output rather than trusting the
config:

- The tombstone was being **precached by the new worker** -- it is a `.js` file in
  `public/`, so the default glob swept it up, caching the worker whose entire
  purpose is to stop a cache from being served. `globIgnores: ['sw.js']`.
- `keep_files: true` in the deploy has quietly become load-bearing for a second
  reason. Each build emits a fresh `workbox-<hash>.js` that `service-worker.js`
  pulls in via `importScripts`, and a device on the previous worker asks for the
  previous hash -- so pruning old files would break every client between a deploy
  and its next update check. It started as a way to avoid clobbering the rest of
  the site; it is now also the thing that makes worker updates safe.

### NOT A FINDING – the PWA's icons are complete; only the full-set dogfood needs a master

Recorded here first as "blocked on source art", which **overstated it**. The PWA
needs 192, 512 and both maskable variants, plus a favicon and an apple-touch-icon.
All six exist at exactly the right sizes, apple-touch at the correct 180px, and
every icon the manifest declares resolves. There is no gap.

What genuinely needs a >=1024px master is the *aspiration* of Icon Stack producing
its own **full multi-platform set** as a dogfood -- and that set is irrelevant to
this app, which is web-only and ships no Tauri build. `graphics/icon-stack/` holds
outputs rather than a master (Chip Away keeps 1024 masters; this app never had
one), so the dogfood would need new art. That is a nice-to-have, not a defect.

Left in place because a findings file that quietly rewrites its own overstatements
is not one anybody should trust. The lesson is about the analysis rather than the
code: "the exports are missing a source" and "the exports are insufficient" are
different claims, and only the first was true.

## Stage E – functional parity with the monorepo build

### FIXED HERE – the preview showed whichever same-size render came first

The worst bug found so far in this app, and it was invisible because the output
always looked plausible.

`SizePreview` picked "the closest render at or above this size" across a
platform's **entire** file set. A platform export is not one icon at several
sizes -- it is several *different* icons. So for PWA, `icon-192.png` and
`icon-maskable-192.png` were interchangeable candidates and whichever
`Object.entries` yielded first won: the preview could show the maskable icon,
with its safe-area padding, while presenting itself as the icon. For Android it
could show `ic_launcher_background.png`, a solid plate with no artwork on it.
For tray it could show the dark variant on a light page.

Fixed by grouping a render into variants derived from the emitted paths --
regular, maskable, light, dark, mono, unplated, and Android's adaptive layers --
and showing one at a time behind a `ToggleGroup`. Deriving them from paths rather
than hardcoding per platform means a variant added in the core surfaces here
without a change.

This also restores, more generally, the light/dark/maskable/monochrome preview
toggles the monorepo version had and the rebuild dropped.

Writing the tests against **real CLI output paths** rather than invented ones paid
for itself immediately: the first classifier enumerated its delimiters as `/_-.`
and so read `trayTemplate-dark@2x.png` -- macOS's retina tray icon -- as regular,
putting the dark tray icon in the same bucket as the light one. The delimiter is
now "not alphanumeric", which cannot be outrun by the next separator someone picks.

### FIXED HERE – a Vite `define` does not reach the test config

Settings gained an About card showing the build version, injected via
`define: { __APP_VERSION__ }` from `package.json` -- the retired app hardcoded
`1.0.0` in the component, which is why it read 1.0.0 forever.

This app has **two** Vite configs: `vite.config.ts` for dev and build,
`vitest.config.ts` for tests. `define` does not carry between them, so declaring
it in one made every component reading it throw `ReferenceError` in the other.
Five tests failed at once, which is the good outcome; a `define` used somewhere
untested would have shipped.

Worth flagging upstream as a starter-template note: any project that adds a
`define` has to add it twice.

### DECIDED – `create-whiskeyjack --pwa` verifies a directory of exported icons

Opt-in rather than default, because a service worker in a project that did not ask
for one is worse than none: it caches aggressively, it is invisible until it
misbehaves, and retiring one takes a tombstone, as this repo demonstrated at
length.

When passed, it **points at already-exported icons** rather than producing them. Given a location, the CLI checks the required PWA sizes are present (192,
512, and both maskable variants), copies them into `public/`, and wires the
manifest; apple-touch-icon and favicon are checked too but optional. A missing or
incomplete location fails with a message naming what was not found.

The CLI does no image processing and takes **no dependency on Icon Stack**, not
even via `npx`. A scaffolder that rasterizes images is a scaffolder with an image
pipeline to maintain, and coupling the starter kit to a separate tool to satisfy
one optional flag is a bad trade. Icon Stack belongs in the error message and the
docs as the recommended way to produce the set, which costs nothing and stays true
if someone would rather use anything else.

What the flag must not do is scaffold a manifest pointing at icons that do not
exist. That is a broken PWA rather than a smaller one -- install prompts fail
quietly and late -- and shipping placeholders instead just trains people to ignore
them.

---

## Deliberately not findings

- **Publishing friction is the point.** A design-system change this app needs
  means publish → install before it can be used. That is what every external
  consumer already experiences; it is the signal being bought, not a defect.
- **`AppPanes` not covering Chip Away's every inset.** Chip Away clears a 64px
  header and Icon Stack a 56px one, so `railPaddingTop` differs (5.5rem vs
  5.25rem) and each app aligns its own first card to it. Parameterising the
  header height inside `AppPanes` would couple it to a header it does not
  render.
