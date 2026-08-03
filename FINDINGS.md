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
