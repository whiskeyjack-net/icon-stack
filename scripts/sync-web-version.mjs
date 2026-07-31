/**
 * Carry the released version onto the web app.
 *
 * The web app is the workspace ROOT, so changesets cannot see it: `linked` and
 * `privatePackages` both operate on workspace MEMBERS, and the root is not one.
 * Left alone it therefore never moves, which is exactly what happened -- it sat
 * at 1.0.0 through the whole rebuild and a dozen notable changes while core and
 * CLI went 0.1.0 -> 0.2.0. Settings' About card reads the number, so the app
 * spent the rebuild telling people a version that meant nothing.
 *
 * The three ship together and describe the same pipeline (the app and the CLI
 * both call `generateIcons` from the core), so one number across all three is
 * the honest description. This runs on the tail of `changeset:version`;
 * `check:release` asserts the result, for the hand-edited bumps that skip
 * changesets entirely -- which is how both releases so far were cut.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const corePath = join(root, 'packages', 'core', 'package.json')
const webPath = join(root, 'package.json')

const version = JSON.parse(readFileSync(corePath, 'utf8')).version
const raw = readFileSync(webPath, 'utf8')
const web = JSON.parse(raw)

if (web.version === version) {
  console.log(`  ok    web app already at ${version}`)
  process.exit(0)
}

// Rewritten as text rather than re-serialised, so the file keeps its key order
// and formatting and the diff is the one line that changed.
const updated = raw.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`)
if (updated === raw) {
  console.error('FAIL  could not find a "version" field to rewrite in package.json')
  process.exit(1)
}

writeFileSync(webPath, updated)
console.log(`  ok    web app ${web.version} -> ${version}`)
