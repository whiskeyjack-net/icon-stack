/**
 * `icon-stack` -- generate a complete app-icon set from one source image.
 *
 * A CLI rather than an MCP server, deliberately. `generateIcons` is config in,
 * bytes out, with no state and no auth: exactly a command's shape. A CLI needs
 * no per-client configuration and no server lifecycle, runs the same in Claude
 * Code, Cursor, Codex and CI, and composes with the other published CLI --
 * `npm create whiskeyjack@latest my-app && npx icon-stack generate ...`. An MCP
 * wrapper over this is a thin layer if one is ever wanted.
 *
 * Writes real files to a directory rather than the web app's ZIP, because that
 * is what a caller with a project on disk actually wants.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import {
  setCanvasBackend,
  generateIcons,
  createDefaultPlatforms,
  PLATFORM_LABELS,
  type Platform,
  type PlatformConfigs,
  type SourceImage,
  type ImageFit,
} from '@whiskeyjack-net/icon-stack-core'
import { nodeCanvasBackend } from '@whiskeyjack-net/icon-stack-core/node'
import { unzipSync } from 'fflate'

const ALL_PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[]

interface Args {
  command: string
  source?: string
  out: string
  platforms?: Platform[]
  fit: ImageFit
  zoom?: number
  cornerRadius?: number
  background?: string
  transparent: boolean
  json: boolean
  quiet: boolean
}

function parseArgs(argv: string[]): Args {
  // A leading flag is not a command: `icon-stack --help` and a bare
  // `icon-stack` both mean help, and option parsing has to start at 0 in that
  // case or the flag is swallowed as a command name.
  const first = argv[0]
  const hasCommand = first !== undefined && !first.startsWith('-')

  const args: Args = {
    command: hasCommand ? first : 'help',
    out: 'icons',
    fit: 'contain',
    transparent: false,
    json: false,
    quiet: false,
  }

  for (let i = hasCommand ? 1 : 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`${a} needs a value`)
      return v
    }
    switch (a) {
      case '--source': case '-s': args.source = next(); break
      case '--out': case '-o': args.out = next(); break
      case '--platforms': case '-p': args.platforms = parsePlatforms(next()); break
      case '--fit': {
        const v = next()
        if (v !== 'contain' && v !== 'cover') throw new Error(`--fit must be contain or cover, got ${v}`)
        args.fit = v
        break
      }
      case '--zoom': args.zoom = Number(next()); break
      case '--corner-radius': args.cornerRadius = Number(next()); break
      case '--background': case '-b': args.background = next(); break
      case '--transparent': args.transparent = true; break
      case '--json': args.json = true; break
      case '--quiet': case '-q': args.quiet = true; break
      case '--help': case '-h': args.command = 'help'; break
      default:
        if (a.startsWith('-')) throw new Error(`Unknown option ${a}`)
        if (!args.source) args.source = a
    }
  }
  return args
}

function parsePlatforms(value: string): Platform[] {
  const names = value.split(',').map((s) => s.trim()).filter(Boolean)
  const unknown = names.filter((n) => !ALL_PLATFORMS.includes(n as Platform))
  if (unknown.length) {
    throw new Error(
      `Unknown platform(s): ${unknown.join(', ')}\nAvailable: ${ALL_PLATFORMS.join(', ')}`,
    )
  }
  return names as Platform[]
}

function mimeFor(path: string): string {
  return extname(path).toLowerCase() === '.svg' ? 'image/svg+xml' : 'image/png'
}

/** Build the SourceImage the core wants from a file on disk. */
function readSource(path: string): SourceImage {
  const abs = resolve(path)
  let bytes: Buffer
  try {
    bytes = readFileSync(abs)
  } catch {
    throw new Error(`Cannot read source image: ${abs}`)
  }

  const mime = mimeFor(abs)
  const isSvg = mime === 'image/svg+xml'
  const svgText = isSvg ? bytes.toString('utf8') : undefined
  const { width, height } = isSvg ? svgSize(svgText!) : pngSize(bytes)

  return {
    type: isSvg ? 'svg' : 'png',
    dataUrl: `data:${mime};base64,${bytes.toString('base64')}`,
    width,
    height,
    svgText,
    fileName: abs.split('/').pop(),
  }
}

/** PNG dimensions live in the IHDR chunk, always at a fixed offset. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!isPng) throw new Error('Source must be a PNG or SVG file.')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** Prefer the viewBox, since width/height may carry units. */
function svgSize(markup: string): { width: number; height: number } {
  const view = markup.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i)
  if (view) return { width: Math.round(Number(view[1])), height: Math.round(Number(view[2])) }
  const w = markup.match(/<svg\b[^>]*\bwidth\s*=\s*["']?([\d.]+)/i)
  const h = markup.match(/<svg\b[^>]*\bheight\s*=\s*["']?([\d.]+)/i)
  if (w && h) return { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) }
  return { width: 1024, height: 1024 }
}

function buildPlatforms(args: Args): PlatformConfigs {
  const platforms = createDefaultPlatforms()

  if (args.platforms) {
    for (const key of ALL_PLATFORMS) platforms[key].enabled = args.platforms.includes(key)
  }

  // AppleConfig is deliberately not a PlatformConfig -- the .icon format owns
  // its own corner and background treatment -- so these apply only where the
  // field exists rather than being forced on with a cast.
  for (const key of ALL_PLATFORMS) {
    const config: PlatformConfigs[Platform] = platforms[key]
    if (args.zoom !== undefined) config.zoom = args.zoom
    if (args.cornerRadius !== undefined && 'cornerRadius' in config) {
      config.cornerRadius = args.cornerRadius
    }
    if (args.transparent && 'bgTransparent' in config) {
      config.bgTransparent = true
    }
    if (args.background) {
      config.bgFill = { type: 'solid', color: normalizeHex(args.background) }
      if ('bgTransparent' in config) config.bgTransparent = false
    }
  }
  return platforms
}

function normalizeHex(value: string): string {
  const hex = value.startsWith('#') ? value : `#${value}`
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`--background must be a 6-digit hex colour, got ${value}`)
  }
  return hex.toUpperCase()
}

/** Source-quality warnings, the same ones the web app surfaces on upload. */
function sourceWarnings(source: SourceImage): string[] {
  const warnings: string[] = []
  if (source.width !== source.height) {
    warnings.push(`Source is ${source.width}x${source.height}. Square sources work best.`)
  } else if (source.type === 'png' && source.width < 1024) {
    warnings.push(`Source is ${source.width}x${source.height}. 1024x1024 is recommended.`)
  }
  return warnings
}

const HELP = `
icon-stack -- generate a complete app-icon set from one source image

Usage
  icon-stack generate --source <file> [--out <dir>] [options]
  icon-stack platforms
  icon-stack inspect --source <file>

Options
  -s, --source <file>       Source PNG or SVG. 1024x1024 square recommended.
  -o, --out <dir>           Output directory (default: icons)
  -p, --platforms <list>    Comma-separated subset (default: the standard set)
      --fit <contain|cover> How a non-square source fills the square (default: contain)
      --zoom <n>            Logo scale percent, 100 = fill (default: 100)
      --corner-radius <n>   Corner rounding percent, 0-50 (default: 0)
  -b, --background <hex>    Bake a solid background, e.g. #1E90FF
      --transparent         Force transparent backgrounds
      --json                Machine-readable output
  -q, --quiet               Only report errors
  -h, --help                This text

Platforms
${ALL_PLATFORMS.map((p) => `  ${p.padEnd(16)} ${PLATFORM_LABELS[p]}`).join('\n')}

Examples
  icon-stack generate --source logo.png --out ./assets/icons
  icon-stack generate -s logo.svg -p favicon,pwa -b #1E90FF
  icon-stack inspect --source logo.png
`.trimStart()

async function commandGenerate(args: Args): Promise<number> {
  if (!args.source) throw new Error('--source is required. See `icon-stack --help`.')

  setCanvasBackend(await nodeCanvasBackend())

  const source = readSource(args.source)
  const warnings = sourceWarnings(source)
  const platforms = buildPlatforms(args)
  const enabled = ALL_PLATFORMS.filter((p) => platforms[p].enabled)

  if (!enabled.length) throw new Error('No platforms selected.')

  const log = (msg: string) => {
    if (!args.quiet && !args.json) process.stdout.write(msg + '\n')
  }

  log(`Source: ${source.fileName} (${source.width}x${source.height}, ${source.type.toUpperCase()})`)
  for (const w of warnings) log(`  warning: ${w}`)
  log(`Platforms: ${enabled.join(', ')}`)

  const zip = await generateIcons({
    source,
    alternate: null,
    platforms,
    sourceFit: args.fit,
    alternateFit: args.fit,
    faviconFit: args.fit,
    trayFit: args.fit,
    onProgress: () => {},
  })

  const outDir = resolve(args.out)
  const files = unzipSync(zip)
  const written: string[] = []
  for (const [name, bytes] of Object.entries(files)) {
    const target = join(outDir, name)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
    written.push(name)
  }
  written.sort()

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          source: { path: resolve(args.source), width: source.width, height: source.height, type: source.type },
          outDir,
          platforms: enabled,
          warnings,
          files: written,
        },
        null,
        2,
      ) + '\n',
    )
  } else {
    log(`\nWrote ${written.length} files to ${outDir}`)
    if (!args.quiet) for (const f of written) log(`  ${f}`)
  }
  return 0
}

function commandPlatforms(args: Args): number {
  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        ALL_PLATFORMS.map((id) => ({ id, label: PLATFORM_LABELS[id] })),
        null,
        2,
      ) + '\n',
    )
  } else {
    for (const id of ALL_PLATFORMS) {
      process.stdout.write(`${id.padEnd(16)} ${PLATFORM_LABELS[id]}\n`)
    }
  }
  return 0
}

function commandInspect(args: Args): number {
  if (!args.source) throw new Error('--source is required.')
  const source = readSource(args.source)
  const warnings = sourceWarnings(source)

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        { path: resolve(args.source), type: source.type, width: source.width, height: source.height, square: source.width === source.height, warnings },
        null,
        2,
      ) + '\n',
    )
  } else {
    process.stdout.write(`${source.fileName}\n`)
    process.stdout.write(`  type    ${source.type.toUpperCase()}\n`)
    process.stdout.write(`  size    ${source.width}x${source.height}\n`)
    process.stdout.write(`  square  ${source.width === source.height ? 'yes' : 'no'}\n`)
    for (const w of warnings) process.stdout.write(`  warning: ${w}\n`)
  }
  return 0
}

export async function main(argv: string[]): Promise<number> {
  let args: Args
  try {
    args = parseArgs(argv)
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`)
    return 1
  }

  try {
    switch (args.command) {
      case 'generate': return await commandGenerate(args)
      case 'platforms': return commandPlatforms(args)
      case 'inspect': return commandInspect(args)
      case 'help': process.stdout.write(HELP); return 0
      default:
        process.stderr.write(`Unknown command "${args.command}".\n\n${HELP}`)
        return 1
    }
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`)
    return 1
  }
}
