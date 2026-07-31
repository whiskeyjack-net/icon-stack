# Releasing the two packages

This repo publishes `@whiskeyjack-net/icon-stack-core` and
`@whiskeyjack-net/icon-stack` (the CLI). The web app is private and never
publishes, and **it still carries the same version number as the two packages**.
All three describe one pipeline – the app and the CLI both call `generateIcons`
from the core – so one number across the three is the honest description, and
Settings' About card shows it to users.

The web app is the workspace **root**, which changesets cannot version:
`linked` and `privatePackages` both operate on workspace members. That is why it
sat at 1.0.0 through the whole rebuild while the packages reached 0.2.0.
`changeset:version` now runs `scripts/sync-web-version.mjs` on its tail to carry
the number across, and `check:release` asserts the three agree.

Both prior releases were hand-rolled version-bump commits, and both went wrong in a
way worth naming, because the guardrails below exist for exactly these:

- **0.2.0 reached npm while `main` still said 0.1.1.** The bump lived on a branch
  that was published from and then merged late. `npm view` and the repo disagreed
  for a day.
- **A macOS rounding fix appeared to do nothing.** It had shipped fine; the check
  was running a `dist/cli.js` built before the change.

## The two traps

**The CLI bundles the core.** `packages/cli/bin` loads `dist/cli.js`, and tsup
inlines the core into it. Consequences:

- Publishing the core alone ships nothing to `npx` users.
- `dist/` is **gitignored** in both packages and `files` packs whatever is on disk,
  so a bundle built before a core change silently ships the old pipeline. There is
  no committed artifact to diff against, which is why `check:release` BUILDS both
  rather than checking them.
- The two versions must move together. A CLI at 0.3.0 carrying a 0.2.0 core
  describes nothing a consumer can act on. `.changeset/config.json` enforces this
  with `linked`, and `check:release` asserts it again, because a hand-edited bump
  bypasses changesets entirely.

**`npx` prefers the workspace.** Running
`npx @whiskeyjack-net/icon-stack@0.2.0 …` from inside this repo resolves to the
local copy, not the registry. Any "does the published CLI do X?" check must run
from a neutral directory, or it tests your own build against itself. That mistake
produced a confident wrong answer once already.

## Cutting a release

```bash
# 1. Describe the change. `linked` means both packages move together.
npm run changeset

# 2. Consume the changesets: bumps versions, writes CHANGELOGs.
npm run changeset:version

# 3. Build both dists -- core FIRST, since the CLI inlines it -- and assert the
#    invariants. Running this is what makes the publish below fresh.
npm run check:release

# 4. Commit the version bump BEFORE publishing. `dist/` is gitignored, so the
#    commit is versions and CHANGELOGs only -- and skipping it is what left npm on
#    0.2.0 while main still said 0.1.1.
git add -A && git commit -m "Release: <versions>"

# 5. Merge to main, THEN publish. Core first.
npm publish ./packages/core --otp=<code>
npm publish ./packages/cli  --otp=<code>
```

Both carry `publishConfig.access: public`, so no `--access` flag. npm 2FA wants a
fresh OTP per publish.

## Verifying afterwards

From **outside** this repo, so npx cannot reach the workspace:

```bash
cd /tmp && npx --yes @whiskeyjack-net/icon-stack@<version> --help
```

For a pipeline change, generate the same icon twice – once with the published CLI
and once locally – and compare bytes. That is what distinguishes "shipped" from
"builds on my machine".

## What is NOT checked here

The monorepo's `check:ranges` guards a 0.x caret trap across three declaration
sites. This repo does not have that problem: its two packages depend on each other
through the workspace rather than a range. What it declares are ranges on the
*consumed* design-system packages, and moving those is a normal dependency bump.
