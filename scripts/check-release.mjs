/**
 * Pre-publish checks for this repo's own two packages.
 *
 * The monorepo has `check:ranges` for the 0.x caret trap. That is not this repo's
 * hazard: its two packages depend on each other through the workspace, not a
 * range. Its hazard is the bundling, and it has cost real time twice.
 *
 *   THE CLI BUNDLES THE CORE. `packages/cli/bin` loads `dist/cli.js`, and tsup
 *   inlines the core into it. So publishing the core alone ships nothing to `npx`
 *   users, and a `dist` built before a core change runs a pipeline that no longer
 *   exists in the source. A macOS rounding fix appeared to do nothing for exactly
 *   this reason: the check was running last week's bundle.
 *
 *   VERSIONS MUST MOVE TOGETHER. A CLI at 0.3.0 carrying a 0.2.0 core describes
 *   nothing a consumer can act on, since the core inside it is not the core on the
 *   registry. Changesets enforces this through `linked`; this asserts it again,
 *   because a hand-edited bump bypasses changesets entirely -- which is how both
 *   releases so far were cut.
 *
 * `dist/` is GITIGNORED in both packages, and `files` packs whatever is on disk. So
 * there is no committed artifact to compare against and nothing to detect: this
 * BUILDS both, core first, and then asserts the invariants. Running it is what
 * makes a subsequent publish fresh, rather than telling you afterwards that it was
 * not.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'))

let failed = false
const fail = (msg, ...detail) => {
  failed = true
  console.error(`FAIL  ${msg}`)
  for (const d of detail) console.error(`      ${d}`)
}

const core = read('packages', 'core', 'package.json')
const cli = read('packages', 'cli', 'package.json')

// --- 1. The two packages version together ------------------------------------
if (core.version === cli.version) {
  console.log(`  ok    ${core.name} and ${cli.name} are both ${core.version}`)
} else {
  fail(
    `version skew: ${core.name}@${core.version} vs ${cli.name}@${cli.version}`,
    'The CLI bundles the core, so the core inside a published CLI is whatever was',
    'built with it. Two different numbers describe one artifact.',
  )
}

// --- 2. Build both, in the order the bundling requires ------------------------
console.log('  ..    building core, then the CLI that inlines it')
try {
  execFileSync('npm', ['run', 'build', '--workspace', core.name], { cwd: root, stdio: 'pipe' })
  execFileSync('npm', ['run', 'build:dist', '--workspace', cli.name], { cwd: root, stdio: 'pipe' })
  console.log('  ok    both dists built fresh')
} catch (err) {
  fail('a dist build failed', String(err.stderr ?? err.message).split('\n').slice(-3).join(' | '))
}

// --- 3. The CLI really did inline the core ------------------------------------
// If tsup ever starts externalising it, the bundle shrinks to a thin wrapper and
// `npx` resolves the core from the registry instead -- which would quietly change
// what a published CLI runs. Pinned by looking for pipeline code that only exists
// in the core.
const bundle = join(root, 'packages', 'cli', 'dist', 'cli.js')
try {
  const text = readFileSync(bundle, 'utf8')
  const markers = ['applyRoundedCorners', 'generateIcons']
  const missing = markers.filter((m) => !text.includes(m))
  if (missing.length) {
    fail(
      `the CLI bundle no longer contains the core (${missing.join(', ')} absent)`,
      'Either tsup stopped inlining it, or the core moved that code. Both change what',
      'a published CLI runs, so the release notes and RELEASING.md need revisiting.',
    )
  } else {
    console.log(`  ok    CLI bundle inlines the core (${Math.round(statSync(bundle).size / 1024)} kB)`)
  }
} catch {
  fail(`cannot read ${bundle}`, 'The CLI build did not produce a bundle.')
}

// --- 4. What no script here can check ----------------------------------------
console.log('')
console.log('  note  `npx <pkg>@<version>` run from INSIDE this repo resolves to the')
console.log('        workspace copy, not the registry. Verify a published CLI from a')
console.log('        neutral directory, or the check tests your own build against itself.')

if (failed) {
  console.error('')
  console.error('Not ready to publish.')
  process.exit(1)
}

console.log('')
console.log('Release checks OK.')
