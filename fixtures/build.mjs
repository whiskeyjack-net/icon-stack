/**
 * Renders fixtures/mark.png from fixtures/mark.svg.
 *
 * The PNG fixture is generated rather than committed as an opaque binary so
 * there is one source of truth for what the test artwork IS, and so anyone can
 * regenerate it. Run `node fixtures/build.mjs` after editing mark.svg.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const here = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(here, 'mark.svg'), 'utf8')
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng()
writeFileSync(join(here, 'mark.png'), png)
console.log(`fixtures/mark.png: ${png.length} bytes, 1024x1024`)
