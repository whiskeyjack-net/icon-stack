# Findings: building on the published packages

Icon Stack is built **outside** the Whiskeyjack monorepo, consuming
`@whiskeyjack-net/design-system`, `@whiskeyjack-net/i18n` and the
`create-whiskeyjack` starter exactly as any third party would. Chip Away stays
inside the monorepo on workspace source. The two together are a control and an
experiment: anything that works in one and not the other is a packaging or
documentation gap, and it lands here.

This file holds the **live** entries, so a design-system release can read it in
a minute and know what to act on. Findings are removed once their fix has
shipped and been consumed here; `git log --follow FINDINGS.md` has the full
record.

Status legend: **OPEN** needs a change upstream · **FIXED HERE** handled
locally, with any upstream ask stated in the entry.

---

## Live

### OPEN – uncontrolled `useTheme` persists `mode` but not `extraDark`

The hook's two modes are asymmetric. Uncontrolled `useTheme` **owns** the
light/dark preference: give it a `storageKey` and it reads, writes, and
broadcasts changes to every other instance in the tab and to other tabs.
`extraDark` beside it is a plain prop the app has to store, read, and sync
itself.

That is a defensible split for the app it was extracted from. Chip Away keeps
the flag in a Dexie settings row and passes it in, so the hook storing it would
have been a second source of truth. It is the wrong default for an app with no
database, which now hand-rolls `src/lib/use-extra-dark.ts`: thirty lines
duplicating the hook's own event-plus-`storage` sync, because Layout applies the
class and Settings sets it and the two must agree with no shared parent. Every
uncontrolled consumer will write those thirty lines.

**Suggested shape:** in uncontrolled mode only, persist `extraDark` under
`` `${storageKey}-extra-dark` `` and return `setExtraDark` alongside `setMode`.
Controlled mode (an explicit `mode` prop) keeps today's behaviour untouched, so
Chip Away is unaffected. No changeset yet.

Worth recording what was already right: the DS applies `.dark.extra-dark` from
`utilities.css` with no app CSS at all, and this app's `index.html` pre-paint
script already read `'oled'` from `launchMirrorKey` and painted `#000000` on
cold launch. The overlay was wired end to end; only the switch and somewhere to
keep its value were missing.

### FIXED HERE – a Vite `define` does not reach the test config

This app has **two** Vite configs: `vite.config.ts` for dev and build,
`vitest.config.ts` for tests. `define` does not carry between them, so a
constant declared in one makes every component reading it throw
`ReferenceError` in the other, at module scope, which takes down whole test
files rather than the one assertion that reads it.

Written upstream in `create-whiskeyjack@0.4.1` as a template README paragraph.
**Then it recurred here on 2026-07-31**, which is the part still worth acting
on: adding `__APP_LICENSE__` and `__APP_REPOSITORY__` reproduced the failure
exactly, in a file carrying a comment warning about it, two lines above the
block that needed the second edit. Documentation loses to a second edit site.

Fixed locally by having both configs import one `appDefines` block from
`app-defines.mjs`, so there is a single place to change and the failure mode is
gone rather than described.

**Upstream ask, still open:** the template should scaffold that shared module in
place of the README paragraph. A warning that a developer reads and then walks
straight into is evidence the warning was the wrong instrument.

---

## Deliberately not findings

- **Publishing friction is the point.** A design-system change this app needs
  means publish → install before it can be used. That is what every external
  consumer already experiences, and it is the signal this repo exists to buy.
- **`AppPanes` not covering Chip Away's every inset.** Chip Away clears a 64px
  header and Icon Stack a 56px one, so `railPaddingTop` differs (5.5rem vs
  5.25rem) and each app aligns its own first card to it. Parameterising the
  header height inside `AppPanes` would couple it to a header it does not
  render.

---

## Closed

Findings were raised across six build stages and fixed upstream in
`design-system@0.6.0`–`0.10.0` and `create-whiskeyjack@0.3.1`–`0.4.1`,
published, and consumed back here. One was withdrawn as incorrect and one was
overstated and corrected. Those entries were retired from this file on
2026-07-31, once the app reached parity with the monorepo version it replaced.

Two process lessons from that round are worth keeping in front of whoever reads
this next:

- **A fix shipping and a finding being recorded as fixed are separate events.**
  Two entries sat marked OPEN after their fix had already gone out, because the
  release that resolved them carried no changeset naming them, and an audit on
  2026-07-29 was what caught it. Status here is verified against published
  artifacts rather than against memory of having asked.
- **A package exports built output, never `src`.** A package whose `main` points
  at TypeScript compiles under the consumer's tsconfig and hands them its own
  type problems, including dependencies they never imported. That one took three
  rounds of fixes and is now a standing rule in `AGENTS.md`.
