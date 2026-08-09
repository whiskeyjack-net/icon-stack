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

Most entries travel outward: something broke here and was fixed upstream. The
traffic also runs the other way, and that direction is worth recording too --
a fix this app **receives** without ever having failed is evidence the
arrangement paid for itself, and it is the only evidence of that kind, since
nothing here breaks to mark the occasion. Those go under Received.

Status legend: **OPEN** needs a change upstream · **FIXED HERE** handled
locally, with any upstream ask stated in the entry · **RECEIVED** found
elsewhere, fixed upstream, arrived here for free.

---

## Live

None. Verified against the published packages on 2026-08-09, not against memory
of having asked.

---

## Received

### RECEIVED – navigation left the scroll position where the last route had it

**design-system 0.17.0**, consumed here 2026-08-06. `AppShell scroll="shell"`
makes `AppMain` the scroller, so the window has no overflow and
`window.scrollTo(0, 0)` scrolls nothing -- silently, with no error to notice.
Nothing reset scroll between `/` and `/settings`, and `useRouteFocus` focuses
with `preventScroll` on purpose, so it moves focus while deliberately leaving
the scroll position alone. Switching from a scrolled Generator opened Settings
halfway down. Fixed by `useScrollReset`, now beside `useRouteFocus` in the
Layout on the same key and ref.

**This was never going to surface here, and that is the entry.** Two routes,
both of which fit a screen at most window sizes, so the symptom needs a narrow
window and a long source list to show up at all. It was found in Learn
Whiskeyjack -- eighty-four lesson pages, so a link followed from halfway down a
long index lands halfway down the next page every time -- and fixed in the
design system, and this app got it without anyone here noticing anything was
wrong.

Worth stating because the rest of this file measures the arrangement in one
direction only. Every other entry is a cost: something broke here that would not
have broken inside the monorepo, and the file exists to make those costs visible
enough to fix. A shared system also pays out, and the payouts are invisible by
construction -- no build fails, no type errors, nothing to file. If the ledger
only ever records what consuming the packages as a third party *costs*, it will
read as an argument against doing it.

The general shape, for the next one: the bug lived in a DS scroll model this app
uses correctly, and needed a consumer with enough pages to trip it. Neither app
could have found it alone, and the one that did had no idea the other was
affected.

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

**A Vite `define` did not reach the test config** (raised 2026-07-31,
**fixed in create-whiskeyjack@0.5.0**, verified against the published tarball
2026-08-06). This app has two Vite configs -- `vite.config.ts` for dev and
build, `vitest.config.ts` for tests -- and `define` does not carry between them,
so a constant declared in one made every component reading it throw
`ReferenceError` in the other, at module scope, taking down whole test files
rather than the one assertion that read it.

It had already been written up upstream, as a README paragraph in
`create-whiskeyjack@0.4.1`. Then it recurred here anyway while adding
`__APP_LICENSE__` and `__APP_REPOSITORY__`, in a file carrying a comment warning
about it, two lines above the block that needed the second edit. The fix was to
stop describing the failure and remove it: both configs here import one
`appDefines` block from `app-defines.mjs`, and the template now scaffolds that
module in place of the paragraph.

**Nothing changes in this app.** The local `app-defines.mjs` written as the
workaround is the same shape the template now ships, so this closes on new
projects rather than on this one -- which is the correct outcome for a finding
whose subject was a *starting point*, and worth noting because "consumed here"
is the usual test for closing an entry and does not apply.

Two things came out of fixing it that the original entry did not anticipate.
The template had no `version` field in its `package.json`, so
`JSON.stringify(pkg.version)` would have injected the literal `undefined` --
the exact "reaches production undefined" failure this entry describes, shipped
inside its own fix, caught only by scaffolding a project and building it. And
the claim itself now has a test standing behind it: a scaffolded project, a
`vitest.config.ts` importing the module, and an assertion on `__APP_VERSION__`
inside a test. The README had asserted that since 0.4.1 with nothing behind it,
which is arguably how the recurrence happened in the first place.

**`useTheme` did not persist `extraDark` when uncontrolled** (raised 2026-07-31,
**fixed in design-system 0.14.0**, consumed here 2026-08-01). The hook owned the
light/dark preference in uncontrolled mode and left the OLED flag as a plain
prop, so this app carried thirty lines re-implementing the hook's own
event-plus-`storage` sync to keep Layout and Settings agreeing. `extraDark` now
follows the same controlled/uncontrolled split as `mode` and resolves
independently of it; `src/lib/use-extra-dark.ts` is deleted. Chip Away, which
keeps the flag in a Dexie row, was unaffected -- which is the case the
controlled path exists for.

One cost worth recording: the DS derives its key from `storageKey`
(`icon-stack-theme-extra-dark`), and the local workaround used
`icon-stack-extra-dark`. Anyone who had switched the overlay on in the few days
between finds it back at its default once. Not worth a migration shim for a
setting that old.

**`CardContent` had no density for a headerless card** (never raised,
**fixed in design-system 0.16.0**, consumed here 2026-08-03). `CardContent`
shipped `p-6 pt-0` -- no top padding, because a `CardHeader` above supplies it.
Almost no card in this app has one; they lead with their own heading inside the
content, so all nine wrote `className="p-5 pt-3"` by hand. Chip Away had done
the same thing nineteen times. `density="compact"` now names it.

The part worth keeping is that **this was never a finding**. It was found by
someone reviewing Chip Away, not here. Every duplication of it was locally
consistent -- nine call sites in this repo all agreeing with each other, and
nineteen in Chip Away likewise -- so nothing inside either app looked wrong, and
this file only ever records what building here made *fail*. A value copied
correctly at twenty-eight sites produces no symptom until two of them disagree,
by which point the disagreement is the bug and the duplication is invisible
prior art.

`SourceSlots` is the case that shows the variant was named for the right thing.
It had already worked the rule out independently -- `cn('p-5', showHeader &&
'pt-3')`, with a comment explaining the top inset exists *only* to balance a
title -- and now says the same thing as `density="compact"` plus a `p-5`
override for the headerless branch. Two apps deriving one rule separately is
the signal the rule belonged upstream; neither of them filing it is the gap.

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
- **This file catches what breaks, not what repeats.** Every entry above began
  as a build failure, a type error, or a missing export -- something that
  stopped work. The `CardContent` density was none of those: it was twenty-eight
  correct copies of two class names across two apps, which compile and render
  perfectly right up until someone changes one of them. Consuming the packages
  as a third party surfaces packaging gaps well and duplication badly, because
  duplication inside one consumer looks like consistency from inside it.
