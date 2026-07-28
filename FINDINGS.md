# Findings: building on the published packages

Icon Stack is deliberately built **outside** the Whiskeyjack monorepo, consuming
`@whiskeyjack-net/design-system`, `@whiskeyjack-net/i18n` and the
`create-whiskeyjack` starter exactly as any third party would. Chip Away stays
inside the monorepo on workspace source. The two together are the control and
the experiment: anything that works in one and not the other is a packaging or
documentation gap, and it lands here.

This file is the point of the exercise. Every entry is something a real external
consumer hits.

Status legend: **OPEN** needs a change upstream · **FIXED HERE** worked around
locally, upstream change still wanted · **PASS** worked as advertised.

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

### OPEN – a package that exports raw TS source imposes its type problems on consumers

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

**Upstream fix:** give the core the same dual-mode build the design system has –
`tsup` for JS plus `tsc` for `.d.ts`, workspace source for in-repo dev, built
`dist` for publishing. The DS does not have this problem precisely because it
ships `dist/index.js` + `dist/index.d.ts`. Any package published from this
family should follow that pattern rather than exporting `src`.

---

### OPEN – `EmptyState`'s CTA is a label and a handler, not a slot

```ts
ctaLabel?: string
onCta?: () => void
```

So the CTA cannot carry an icon, cannot use a non-accent `Button` variant, and
cannot be a `<label>` wrapping a file input – all reasonable things for an empty
state whose entire purpose is "start here". The drop zone wanted an upload icon
on the button and had to drop it.

**Upstream fix:** accept `action?: ReactNode` as an alternative to
`ctaLabel`/`onCta`, keeping both for compatibility. Matches how `BottomDrawer`
takes a `footer` slot rather than button descriptions.

### OPEN – generated component docs describe behaviour but never list props

`docs/empty-state.md` ships in the package and says "optional call to action",
which is what led to guessing `action`. It never names `ctaLabel`/`onCta`. The
`.d.ts` is currently the only place a consumer can learn a component's actual
API.

**Upstream fix:** have `build-docs.mjs` emit a props table from the `.d.ts` tree
it already ships alongside. The manifest's `docs` field answers "which component
and when"; it should not have to answer "what props", but something should.

---

### OPEN – the starter assumes Tauri, and a pure-web app pays for it

The template hard-depends on `@whiskeyjack-net/tauri` and wires window controls
into the shell. Icon Stack is pure web and always will be. The dependency is
inert at runtime, but it is a **15.3 kB** `window-*.js` chunk in a build that
will never use it, plus a dependency to keep updated.

**Upstream fix:** either a `--no-tauri` flag on `create-whiskeyjack`, or a short
"removing Tauri" section in the template README naming the files to touch.

### OPEN – the starter scaffolds a single package, with no path to workspaces

Icon Stack needs `packages/core` and `packages/cli` beside the app. Converting
the scaffold to npm workspaces was entirely manual: adding `workspaces`, moving
`test`/`typecheck` to `--workspaces --if-present`, and reconciling the app's
DOM-targeted tsconfig with the CLI's Node-targeted one.

**Upstream fix:** not necessarily a scaffold option – but the template README
should say what to do when an app grows a package beside it, since the tsconfig
interaction is the non-obvious part.

---

### FIXED HERE – the published packages shipped no LICENSE file

`@whiskeyjack-net/design-system`, `i18n` and `tauri` all declare `"license":
"MIT"` in package.json, but no LICENSE text is in the tarball. An MIT claim with
no license text is not a license grant a recipient can rely on.

**Upstream fix:** the design-system stage script already copies `LICENSE`;
confirm i18n and tauri do the same. Fixed in this repo at the root and in both
packages.

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

## Deliberately not findings

- **Publishing friction is the point.** A design-system change this app needs
  means publish → install before it can be used. That is what every external
  consumer already experiences; it is the signal being bought, not a defect.
