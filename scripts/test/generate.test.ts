// @vitest-environment node
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { entries, groups } from '../../icons/catalog.ts'
import { generate, partsOf, pascal } from '../generate.ts'

const svg = (body: string, extra = '') => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"${extra}>${body}</svg>`
const line = (d: string, id = '') => `<path${id ? ` id="${id}"` : ''} d="${d}" stroke="#EAEAE9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`

let root: string
const put = async (weight: 'filled' | 'outline', name: string, text: string) => {
  await mkdir(join(root, 'icons', weight), { recursive: true })
  await writeFile(join(root, 'icons', weight, `${name}.svg`), text)
}
const out = (f: string) => readFile(join(root, 'packages/icons/src/icons', f), 'utf8')

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ikoons-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('the catalog', () => {
  it('has every name once, in kebab-case, each with a motion', () => {
    const names = groups.flatMap(g => g.icons.map(e => e.name))
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    for (const e of entries.values()) expect(typeof e.motion[0]).toBe('string')
  })
  it('names logos …-logo, a logo taking its colour on hover with a colour or null', () => {
    for (const e of groups.find(g => g.id === 'brands')!.icons) {
      expect(e.name).toMatch(/-logo$/)
      if (e.motion[0] === 'brand') expect(e.brand === null || /^#[0-9a-f]{6}$/.test(e.brand!)).toBe(true)
    }
  })
  it('knows which layers a motion looks for', () => {
    expect(partsOf(['swing', { follow: 'clapper' }])).toEqual(['clapper'])
    expect(partsOf(['draw', { parts: ['circle', 'tick'] }])).toEqual(['circle', 'tick'])
    expect(partsOf(['combo', { of: [['swing', { part: 'antenna' }], ['blink', { part: 'eye' }]] }])).toEqual(['antenna', 'eye'])
  })
})

describe('generate', () => {
  it('writes a module per drawn icon, the barrel and the list, in the catalog order', async () => {
    await put('outline', 'bell', svg(line('M6 9a6 6 0 0 1 12 0', 'body') + line('M10 19.5a2 2 0 0 0 4 0', 'clapper')))
    await put('filled', 'bell', svg('<path d="M6 9a6 6 0 0 1 12 0Z" fill="#EAEAE9"/>'))
    await put('outline', 'arrow-left', svg(line('M20 12H4')))
    const r = await generate({ root })
    expect(r.drawn).toEqual(['arrow-left', 'bell'])
    const files = await readdir(join(root, 'packages/icons/src/icons'))
    expect(files.sort()).toEqual(['all.ts', 'arrow-left.ts', 'bell.ts', 'index.ts'])
    const bell = await out('bell.ts')
    expect(bell).toMatch(/^\/\/ Generated from icons\/filled\/bell\.svg and icons\/outline\/bell\.svg/)
    expect(bell.split('\n')[1]).toBe(`'use client'`)
    expect(bell).toContain(`export const Bell = /*#__PURE__*/ createIcon("bell"`)
    expect(bell).toContain(`motion: /*#__PURE__*/ swing({follow:"clapper"})`)
    expect(bell).toContain(`import { swing } from '../motion/recipes.js'`)
    expect(bell).toContain('@preview ![bell](data:image/svg+xml;base64,')
    const index = await out('index.ts')
    expect(index).toContain(`export { Bell, Bell as BellIcon } from './bell.js'`)
    expect(index).toContain(`| "arrow-left"`)
    expect(await out('all.ts')).toContain('export const all = [ArrowLeft, Bell] as const')
  })

  it('says which layer a motion is missing, and which weight is missing', async () => {
    await put('outline', 'bell', svg(line('M6 9a6 6 0 0 1 12 0')))
    await put('outline', 'trash', svg(line('M4 6.5h16')))
    await put('filled', 'trash', svg('<path d="M6 7h12l-1 13H7Z" fill="white"/>'))
    const r = await generate({ root })
    expect(r.warnings).toEqual([
      'trash (filled): its motion (open) looks for a layer named "lid" — without it the icon just pops',
      'trash (outline): its motion (open) looks for a layer named "lid" — without it the icon just pops',
      'bell: only outline is drawn — filled shows it too',
      'bell (outline): no layer named "clapper" — its motion (swing) plays without that part',
    ])
  })

  it('gives a pair its transition only when both are drawn', async () => {
    await put('outline', 'play', svg(line('M7 5v14l12-7Z')))
    expect(await out('play.ts').catch(() => '')).toBe('')
    await generate({ root })
    expect(await out('play.ts')).not.toContain('to: {')
    await put('outline', 'pause', svg(line('M8 5v14M16 5v14')))
    await generate({ root })
    expect(await out('play.ts')).toContain(`to: { pause: /*#__PURE__*/ morph() }`)
    expect(await out('play.ts')).toContain(`import { morph } from '../motion/transitions.js'`)
  })

  it('marks placeholders, and a logo with its colour', async () => {
    await put('outline', 'heart', svg(line('M12 20 4 10a4 4 0 0 1 8-3 4 4 0 0 1 8 3Z'), ' data-placeholder="true"'))
    await put('filled', 'spotify-logo', svg('<circle cx="12" cy="12" r="10" fill="black"/>'))
    const r = await generate({ root })
    expect(r.placeholders).toEqual(['heart'])
    expect(await out('heart.ts')).toContain('placeholder: true')
    expect(await out('spotify-logo.ts')).toContain('brand: "#1ed760"')
  })

  it('rewrites only what changed, and removes what is gone', async () => {
    await put('outline', 'check', svg(line('M5 12l5 5L19 7')))
    await put('outline', 'x', svg(line('M6 6l12 12M18 6 6 18')))
    await generate({ root })
    const first = (await stat(join(root, 'packages/icons/src/icons/check.ts'))).mtimeMs
    await rm(join(root, 'icons/outline/x.svg'))
    await new Promise(r => setTimeout(r, 20))
    await generate({ root })
    expect((await stat(join(root, 'packages/icons/src/icons/check.ts'))).mtimeMs).toBe(first)
    expect(await readdir(join(root, 'packages/icons/src/icons'))).not.toContain('x.ts')
  })

  it('stops on a name the catalog does not have, or a bad drawing, and lists every problem', async () => {
    await put('outline', 'bel', svg(line('M1 1h2')))
    await put('outline', 'Bell', svg(line('M1 1h2')))
    await put('filled', 'check', svg('<path d="M1 1h2" stroke="red"/><path d="M1 3h2" stroke="blue"/>'))
    const message = await generate({ root }).then(() => '', (e: Error) => e.message)
    expect(message).toContain(`icons/outline/bel.svg: "bel" isn't in icons/catalog.ts`)
    expect(message).toContain('icons/outline/Bell.svg: name it in kebab-case')
    expect(message).toContain('icons/filled/check.svg: it uses 2 colours')
  })

  it('names components in PascalCase', () => {
    expect(pascal('arrow-u-up-left')).toBe('ArrowUUpLeft')
    expect(pascal('x')).toBe('X')
    expect(pascal('dev-to-logo')).toBe('DevToLogo')
  })
})

describe('the repo’s own drawings', () => {
  it('all build, every one marked as a placeholder except Kivz’s own marks', async () => {
    const r = await generate()
    expect(r.drawn.length).toBeGreaterThan(20)
    expect(r.drawn.filter(n => !r.placeholders.includes(n))).toEqual(['kivz-logo', 'ikoons-logo'])
  })
})
