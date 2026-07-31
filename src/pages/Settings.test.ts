/**
 * The Settings CLI card documents commands. This checks they are real.
 *
 * A card of example commands is documentation that ships inside the product, and
 * it rots the same way a README does -- except a wrong flag here is a command
 * someone pastes into a terminal and watches fail. So every flag and subcommand
 * shown is checked against the CLI's own parser rather than against a list kept
 * beside it.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const settings = readFileSync(join(root, 'src', 'pages', 'Settings.tsx'), 'utf8')
const cli = readFileSync(join(root, 'packages', 'cli', 'src', 'cli.ts'), 'utf8')

/** The example command lines the card renders. */
const commands = [...settings.matchAll(/command: '([^']+)'/g)].map((m) => m[1])

/** Every flag and alias the CLI's argument parser accepts. */
const accepted = new Set(
  [...cli.matchAll(/case '(-{1,2}[a-z-]+)'/g)].map((m) => m[1]),
)

/** Subcommands the CLI dispatches on. */
const subcommands = new Set(
  [...cli.matchAll(/command = '(\w+)'|'(generate|platforms|inspect)'/g)]
    .flatMap((m) => [m[1], m[2]])
    .filter(Boolean),
)

describe('the Settings CLI card', () => {
  it('shows some commands to check', () => {
    expect(commands.length).toBeGreaterThan(2)
    expect(accepted.size).toBeGreaterThan(5)
  })

  it('names the published package, not a local path', () => {
    // It has to be copy-pasteable by someone who has never cloned this repo.
    for (const command of commands) {
      expect(command).toMatch(/^npx @whiskeyjack-net\/icon-stack\b/)
    }
  })

  it.each(commands)('every flag in %s is one the CLI accepts', (command) => {
    const flags = command.match(/(?<![\w-])-{1,2}[a-z][a-z-]*/g) ?? []
    const unknown = flags.filter((f) => !accepted.has(f))
    expect(unknown, `not accepted by the CLI parser: ${unknown.join(', ')}`).toEqual([])
  })

  it.each(commands)('every subcommand in %s is one the CLI dispatches', (command) => {
    // The word after the package name, when it is not a flag.
    const word = command.replace(/^npx @whiskeyjack-net\/icon-stack\s*/, '').split(/\s+/)[0]
    if (!word || word.startsWith('-')) return
    expect(subcommands.has(word), `${word} is not a CLI subcommand`).toBe(true)
  })

  it('passes a source to every generate example, since it is required', () => {
    for (const command of commands) {
      if (!command.includes(' generate')) continue
      expect(command).toMatch(/(--source|-s)\s/)
    }
  })
})
