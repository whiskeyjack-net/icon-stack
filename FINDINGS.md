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

**Round trip so far:** five findings raised, fixed upstream in
`design-system@0.6.0` / `create-whiskeyjack@0.3.1`, published, and consumed back
here. One withdrawn as incorrect. Two open.

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

### RESOLVED – generated component docs describe behaviour but never list props

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

### FIXED HERE – lint had never run over this code

`prefer-const` on `generate.ts:375` and a stale `eslint-disable` in
`browser.ts` were both latent in the monorepo, because **all nine monorepo apps
declare a `lint` script and none has an `eslint.config.js`** – it has never
executed anywhere. The starter's flat config caught both within a minute of the
code arriving here.

This is a good advertisement for the starter shipping a working lint setup, and
an argument for the monorepo adopting the same one.

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

## Deliberately not findings

- **Publishing friction is the point.** A design-system change this app needs
  means publish → install before it can be used. That is what every external
  consumer already experiences; it is the signal being bought, not a defect.
