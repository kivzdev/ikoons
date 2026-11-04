// Turns the drawings in icons/{filled,outline}/*.svg into the React package's icon modules
// (packages/icons/src/icons/<name>.ts), one module per icon so a bundler keeps only the ones you import, plus the barrel.
// `npm run gen` runs it; so do the build, the tests and the preview (which also reruns it when a drawing changes).

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { entries, groups, pairs, type Motion } from '../icons/catalog.ts'
import { DrawingError, normalise, reactAttrs, reactNodes, toSvg, type Drawing } from './svg.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const WEIGHTS = ['filled', 'outline'] as const
export type Weight = (typeof WEIGHTS)[number]

/** bell → Bell, arrow-u-up-left → ArrowUUpLeft */
export const pascal = (name: string) => name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')

const PART_KEYS = ['part', 'follow', 'inner', 'main', 'small', 'glints']
// layers a motion uses if they're there, and moves without (a bell swings without its clapper)
const EXTRA_KEYS = new Set(['follow', 'inner', 'glints'])
/** the layer names a motion looks for in the drawing */
export function partsOf(m: Motion): string[] {
  return needs(m).map(n => n.part)
}
function needs([recipe, params = {}]: Motion): { part: string; extra: boolean }[] {
  if (recipe === 'combo') return (params.of as Motion[]).flatMap(needs)
  const out = PART_KEYS.filter(k => typeof params[k] === 'string').map(k => ({ part: params[k] as string, extra: EXTRA_KEYS.has(k) }))
  if (Array.isArray(params.parts)) out.push(...(params.parts as string[]).map(part => ({ part, extra: false })))
  return out
}

const js = (v: unknown) => JSON.stringify(v).replace(/"([a-zA-Z_$][\w$]*)":/g, '$1:')
/** an object key as code: bare where it can be */
const key = (k: string) => (/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k))
const args = (params: Record<string, unknown>) => (Object.keys(params).length ? js(params) : '')

/** a motion from the catalog as code: `swing({ follow: "clapper" })`, with what it needs imported */
function motionCode([recipe, params = {}]: Motion, use: Set<string>): string {
  if (recipe === 'combo') {
    use.add('combo')
    return `combo(${(params.of as Motion[]).map(m => motionCode(m, use)).join(', ')})`
  }
  if (recipe === 'brand') {
    use.add('pop')
    return 'pop({ s: 0.08 })'
  }
  const { delay, ...rest } = params as Record<string, unknown>
  use.add(recipe)
  const code = `${recipe}(${args(rest)})`
  if (typeof delay !== 'number') return code
  use.add('later')
  return `later(${delay}, ${code})`
}

export interface Report {
  drawn: string[]
  placeholders: string[]
  warnings: string[]
}

async function list(dir: string) {
  try {
    return (await readdir(dir)).filter(f => f.endsWith('.svg')).sort()
  } catch {
    return []
  }
}

/** writes only what changed (so a dev server reloads only what's new), and removes what's gone */
async function sync(dir: string, files: Map<string, string>) {
  await mkdir(dir, { recursive: true })
  for (const f of await readdir(dir)) if (!files.has(f)) await rm(join(dir, f), { force: true })
  for (const [f, text] of files) {
    const now = await readFile(join(dir, f), 'utf8').catch(() => null)
    if (now !== text) await writeFile(join(dir, f), text)
  }
}

export async function generate({ root = ROOT }: { root?: string } = {}): Promise<Report> {
  const problems: string[] = []
  const warnings: string[] = []
  const drawings = new Map<string, Partial<Record<Weight, Drawing>>>()

  for (const w of WEIGHTS) {
    for (const file of await list(join(root, 'icons', w))) {
      const name = file.slice(0, -4)
      const where = `icons/${w}/${file}`
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) { problems.push(`${where}: name it in kebab-case (like arrow-up-right.svg)`); continue }
      if (!entries.has(name)) { problems.push(`${where}: "${name}" isn't in icons/catalog.ts — add it there, or check the spelling`); continue }
      try {
        const d = normalise(await readFile(join(root, 'icons', w, file), 'utf8'), { icon: name, file: where })
        drawings.set(name, { ...drawings.get(name), [w]: d })
      } catch (e) {
        if (e instanceof DrawingError) problems.push(e.message)
        else throw e
      }
    }
  }
  if (problems.length) throw new DrawingError(problems.join('\n'))

  // the catalog's order (groups, then each group's list)
  const order = groups.flatMap(g => g.icons.map(e => e.name)).filter(n => drawings.has(n))
  const files = new Map<string, string>()
  const placeholders: string[] = []

  for (const name of order) {
    const e = entries.get(name)!
    const d = drawings.get(name)!
    const weights = WEIGHTS.filter(w => d[w])
    const placeholder = weights.some(w => d[w]!.placeholder)
    if (placeholder) placeholders.push(name)
    // (logos are drawn filled only)
    if (e.group !== 'brands' && weights.length < 2) warnings.push(`${name}: only ${weights[0]} is drawn — ${weights[0] === 'filled' ? 'outline' : 'filled'} shows it too`)
    const seen = new Set<string>()
    for (const { part, extra } of needs(e.motion)) {
      if (seen.has(part)) continue
      seen.add(part)
      for (const w of weights) {
        if (d[w]!.parts.has(part)) continue
        warnings.push(extra
          ? `${name} (${w}): no layer named "${part}" — its motion (${e.motion[0]}) plays without that part`
          : `${name} (${w}): its motion (${e.motion[0]}) looks for a layer named "${part}" — without it the icon just pops`)
      }
    }

    const use = new Set<string>()
    const extra: string[] = []
    extra.push(`motion: /*#__PURE__*/ ${motionCode(e.motion, use)}`)
    if (e.motion[0] === 'brand') extra.push(`brand: ${js(e.brand)}`)
    if (e.loop) extra.push('loop: true')
    const transitions = new Set<string>()
    const to = pairs
      .filter(([from, other]) => from === name && drawings.has(other))
      .map(([, other, [t, p = {}]]) => {
        transitions.add(t)
        return `${key(other)}: /*#__PURE__*/ ${t}(${args(p)})`
      })
    if (to.length) extra.push(`to: { ${to.join(', ')} }`)
    if (placeholder) extra.push('placeholder: true')

    const sources = weights.map(w => `icons/${w}/${name}.svg`).join(' and ')
    const group = groups.find(g => g.icons.some(i => i.name === name))!
    const shown = d.filled ?? d.outline!
    const preview = Buffer.from(toSvg(shown, { size: 48, colour: '#eaeae9', background: '#141414' })).toString('base64')
    const drawn = weights
      .map(w => `    ${w}: { a: ${js(reactAttrs(d[w]!.layer))}, n: ${js(reactNodes(d[w]!.nodes))} },`)
      .join('\n')
    const imports = [
      `import { createIcon } from '../core/create.js'`,
      use.size ? `import { ${[...use].sort().join(', ')} } from '../motion/recipes.js'` : '',
      transitions.size ? `import { ${[...transitions].sort().join(', ')} } from '../motion/transitions.js'` : '',
    ].filter(Boolean)
    const doc = [
      `/**`,
      ` * ${name} — ${group.title}${e.star ? ' ★' : ''}${placeholder ? ' (placeholder drawing)' : ''}`,
      ` *`,
      ` * Motion: ${e.motion[0]}${e.loop ? ', on and on' : ''}${to.length ? `; to ${pairs.filter(p => p[0] === name && drawings.has(p[1])).map(p => p[1]).join(', ')} by ${[...transitions].join(', ')}` : ''}.`,
      e.idea ? ` * Kivz: “${e.idea}”` : '',
      ` *`,
      ` * @preview ![${name}](data:image/svg+xml;base64,${preview})`,
      ` */`,
    ].filter(Boolean)
    files.set(`${name}.ts`, [
      `// Generated from ${sources} by scripts/generate.ts — edit those, not this.`,
      `'use client'`,
      ...imports,
      ``,
      ...doc,
      `export const ${pascal(name)} = /*#__PURE__*/ createIcon(${js(name)}, {`,
      drawn,
      `}, {`,
      ...extra.map(x => `  ${x},`),
      `})`,
      ``,
    ].join('\n'))
  }

  files.set('index.ts', [
    `// Generated by scripts/generate.ts: every icon that is drawn, in the catalog's order. Each also goes by <Name>Icon,`,
    `// for files where the plain name is taken (Link, Image, File…).`,
    ...order.map(n => `export { ${pascal(n)}, ${pascal(n)} as ${pascal(n)}Icon } from './${n}.js'`),
    ``,
    `/** the names of the icons that are drawn */`,
    `export type IconName =`,
    ...order.map(n => `  | ${js(n)}`),
    ``,
  ].join('\n'))
  files.set('all.ts', [
    `// Generated by scripts/generate.ts. Every icon at once, for galleries and pickers — importing this pulls in all of them.`,
    ...order.map(n => `import { ${pascal(n)} } from './${n}.js'`),
    ``,
    `export const all = [${order.map(pascal).join(', ')}] as const`,
    ``,
  ].join('\n'))

  await sync(join(root, 'packages/icons/src/icons'), files)
  return { drawn: order, placeholders, warnings }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = await generate()
    const total = entries.size
    const stars = [...entries.values()].filter(e => e.star)
    const starsDrawn = stars.filter(e => r.drawn.includes(e.name)).length
    console.log(`icons: ${r.drawn.length} of ${total} drawn (${r.placeholders.length} of them placeholders) · ★ ${starsDrawn} of ${stars.length}`)
    for (const w of r.warnings) console.log(`  note: ${w}`)
  } catch (e) {
    if (!(e instanceof DrawingError)) throw e
    console.error(`icons: the drawings need a fix first:\n${e.message.split('\n').map(l => `  ${l}`).join('\n')}`)
    process.exit(1)
  }
}
