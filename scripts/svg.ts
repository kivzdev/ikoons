// Reads one drawing (an SVG as Figma exports it) and turns it into the set's own form: one colour (currentColor),
// stroke widths as a share of the 2-unit line, Figma layer names as parts, the frame's clip and background gone.
// No dependencies: a small XML reader is enough for what design tools write.

import { formatPath, parsePath, subpaths } from '../packages/icons/src/motion/path.ts'

export interface El {
  tag: string
  attrs: Record<string, string>
  children: El[]
}

/** a node of a drawing: [tag, attributes (SVG names), children] */
export type Node = [tag: string, attrs: Record<string, string | number>, children?: Node[]]

export interface Drawing {
  /** paint the layer group carries for all its shapes (they only say where they differ) */
  layer: Record<string, string | number>
  nodes: Node[]
  /** part names found, with how many layers carry each */
  parts: Map<string, number>
  placeholder: boolean
}

export class DrawingError extends Error {}

// ── reading XML ──────────────────────────────────────────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m)

export function parseXml(text: string): { root: El; comments: string[] } {
  const comments: string[] = []
  const stack: El[] = [{ tag: '#document', attrs: {}, children: [] }]
  let i = 0
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt < 0) break
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4)
      if (end < 0) throw new DrawingError('an unclosed comment')
      comments.push(text.slice(lt + 4, end).trim())
      i = end + 3
    } else if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt)
      i = end < 0 ? text.length : end + 3
    } else if (text.startsWith('<?', lt) || text.startsWith('<!', lt)) {
      const end = text.indexOf('>', lt)
      i = end < 0 ? text.length : end + 1
    } else if (text[lt + 1] === '/') {
      const end = text.indexOf('>', lt)
      const tag = text.slice(lt + 2, end).trim()
      const open = stack.pop()
      if (!open || open.tag !== tag) throw new DrawingError(`</${tag}> closes <${open?.tag ?? 'nothing'}>`)
      i = end + 1
    } else {
      // a start tag: find its end, minding quoted attribute values
      let j = lt + 1
      let quote = ''
      for (; j < text.length; j++) {
        const ch = text[j]
        if (quote) { if (ch === quote) quote = '' }
        else if (ch === '"' || ch === "'") quote = ch
        else if (ch === '>') break
      }
      if (j >= text.length) throw new DrawingError('an unclosed tag')
      let body = text.slice(lt + 1, j)
      const selfClosing = body.endsWith('/')
      if (selfClosing) body = body.slice(0, -1)
      const tag = /^[^\s/>]+/.exec(body)![0]
      const attrs: Record<string, string> = {}
      const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
      for (let m; (m = re.exec(body.slice(tag.length))); ) attrs[m[1]] = decode(m[2] ?? m[3] ?? '')
      const el: El = { tag, attrs, children: [] }
      stack[stack.length - 1].children.push(el)
      if (!selfClosing) stack.push(el)
      i = j + 1
    }
  }
  if (stack.length !== 1) throw new DrawingError(`<${stack[stack.length - 1].tag}> is never closed`)
  const root = stack[0].children[0]
  if (!root) throw new DrawingError('no elements')
  return { root, comments }
}

// ── normalising ──────────────────────────────────────────────────────────────────────────────────────────────────────

const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'])
const SKIP = new Set(['title', 'desc', 'metadata', 'defs'])
const INHERITED = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule', 'clip-rule', 'fill-opacity', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset']
const GEOMETRY: Record<string, string[]> = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
}
/** the width every line is drawn at, on the 24 grid: `strokeWidth` is a multiple of it */
export const LINE = 2
// what Figma calls a layer it wasn't given a name for — those aren't parts. Line, Arrow, Star, Shape and Layer only
// (and Clip) as Figma writes them, capitalised: in lowercase they're parts like any other (a list's line, an arrow, a
// wand's star, a clipboard's clip)
const UNNAMED = /^(vector|rectangle|ellipse|polygon|union|subtract|intersect|exclude|group|frame|path|boolean|mask|vector-stroke|stroke)(-\d+)?$|^clip\d/
const FIGMA_NAMED = /^(Line|Arrow|Star|Shape|Layer|Clip)([\s_]\d+)?$/

const round = (n: number, digits = 3) => +n.toFixed(digits)

// one colour written several ways (black, #000, rgb(0,0,0)) is still one colour
const NAMED: Record<string, string> = { black: '#000000', white: '#ffffff' }
function colour(s: string): string {
  if (NAMED[s]) return NAMED[s]
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(s)
  if (rgb) return `#${rgb.slice(1, 4).map(n => (+n).toString(16).padStart(2, '0')).join('')}`
  return s
}
const roundNumbers = (s: string) => s.replace(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g, n => String(round(Number(n))))

/** a Figma layer name (exported as an id) → a part name, or null for an unnamed layer */
export function partName(id: string, icon: string): string | null {
  if (FIGMA_NAMED.test(id.trim())) return null
  const name = id.replace(/_\d+$/, '').trim().toLowerCase().replace(/[\s_]+/g, '-')
  if (!name || name === icon || id.includes('/') || UNNAMED.test(name)) return null
  return name
}

const styleOf = (el: El) => {
  const out: Record<string, string> = {}
  for (const decl of (el.attrs.style ?? '').split(';')) {
    const k = decl.indexOf(':')
    if (k > 0) out[decl.slice(0, k).trim()] = decl.slice(k + 1).trim()
  }
  return out
}
/** an element's own presentation (its style attribute wins over its attributes) */
const own = (el: El) => ({ ...el.attrs, ...styleOf(el) })

export function normalise(text: string, { icon, file }: { icon: string; file: string }): Drawing {
  const fail = (what: string): never => {
    throw new DrawingError(`${file}: ${what}`)
  }
  let parsed: ReturnType<typeof parseXml>
  try {
    parsed = parseXml(text)
  } catch (e) {
    return fail((e as Error).message)
  }
  const { root, comments } = parsed
  if (root.tag !== 'svg') fail(`the file starts with <${root.tag}>, not <svg>`)

  // the grid: every icon is drawn on a 24 × 24 frame
  const vb = root.attrs.viewBox?.trim().split(/[\s,]+/).map(Number)
  const ok = vb ? vb.length === 4 && vb[0] === 0 && vb[1] === 0 && vb[2] === 24 && vb[3] === 24 : root.attrs.width === '24' && root.attrs.height === '24'
  if (!ok) fail(`draw it on a 24 × 24 frame (viewBox "0 0 24 24"); this one is ${root.attrs.viewBox ? `"${root.attrs.viewBox}"` : `${root.attrs.width} × ${root.attrs.height}`}`)

  const placeholder = 'data-placeholder' in root.attrs || comments.some(c => /placeholder/i.test(c))

  // <defs>: Figma's frame clip ("Clip content": a rect over the whole frame) is fine and goes; anything else is a
  // second colour or an effect, which an icon doesn't have
  const frameClips = new Set<string>()
  for (const defs of root.children.filter(c => c.tag === 'defs')) {
    for (const d of defs.children) {
      const r = d.children[0]
      const whole = d.tag === 'clipPath' && d.children.length === 1 && r.tag === 'rect' && +(r.attrs.width ?? 0) >= 24 && +(r.attrs.height ?? 0) >= 24 && !+(r.attrs.x ?? 0) && !+(r.attrs.y ?? 0)
      if (whole && d.attrs.id) frameClips.add(d.attrs.id)
      else fail(`<${d.tag}> in <defs>: masks, gradients, filters and clips don't make it into an icon — it's one colour`)
    }
  }

  const colours = new Set<string>()
  const paint = (v: string | undefined, fallback: string) => {
    const s = (v ?? fallback).trim().toLowerCase()
    if (s === 'none' || s === 'transparent') return 'none'
    if (s !== 'currentcolor') colours.add(colour(s))
    return 'currentColor'
  }

  const parts = new Map<string, number>()
  type Leaf = { tag: string; attrs: Record<string, string | number>; sw: number | null }
  type Out = Node | { leaf: Leaf }

  const walk = (el: El, inherited: Record<string, string>): Out[] => {
    if (SKIP.has(el.tag)) return []
    const mine = own(el)
    if (mine.mask || mine.filter) fail(`<${el.tag}> has a ${mine.mask ? 'mask' : 'filter'}: an icon is one flat colour`)
    const clip = mine['clip-path']
    if (clip) {
      const id = /url\(#([^)]+)\)/.exec(clip)?.[1]
      if (!id || !frameClips.has(id)) fail(`<${el.tag}> is clipped: cut the shape itself instead`)
    }
    const next = { ...inherited }
    for (const k of INHERITED) if (mine[k] !== undefined) next[k] = mine[k]
    let out: Out[]
    if (el.tag === 'g' || el.tag === 'svg') {
      out = el.children.flatMap(c => walk(c, next))
      const extra: Record<string, string | number> = {}
      if (el.tag === 'g' && mine.transform) extra.transform = roundNumbers(mine.transform)
      if (el.tag === 'g' && mine.opacity !== undefined && +mine.opacity < 1) extra.opacity = round(+mine.opacity)
      if (Object.keys(extra).length) out = [['g', extra, out as Node[]]]
    } else if (SHAPES.has(el.tag)) {
      out = shape(el, mine, next)
    } else {
      return fail(`<${el.tag}> isn't something an icon can be made of — use paths and basic shapes`)
    }
    // a named layer is a part: the motions find it by its name
    const part = el.tag !== 'svg' && mine.id ? partName(mine.id, icon) : null
    if (part) {
      parts.set(part, (parts.get(part) ?? 0) + 1)
      // (an fx- part is an effect: it only shows while the icon moves)
      out = [['g', { 'data-part': part, ...(part.startsWith('fx-') && { opacity: 0 }) }, out as Node[]]]
    }
    return out
  }

  const shape = (el: El, mine: Record<string, string>, p: Record<string, string>): Out[] => {
    const attrs: Record<string, string | number> = {}
    for (const k of GEOMETRY[el.tag]) {
      const v = mine[k]
      if (v === undefined) continue
      attrs[k] = k === 'd' ? formatPath(parsePath(v)) : k === 'points' ? roundNumbers(v) : round(+v)
    }
    if (el.tag === 'path' && !attrs.d) return []
    if (el.tag === 'rect' && !+(mine.x ?? 0) && !+(mine.y ?? 0) && +(mine.width ?? 0) >= 24 && +(mine.height ?? 0) >= 24 && (p.fill ?? 'black') !== 'none')
      fail('the frame has a fill (a rect over all of it): leave the frame empty, the icon takes its colour from the page')
    const fill = paint(p.fill, 'black') // (SVG's own default)
    const stroke = paint(p.stroke, 'none')
    attrs.fill = fill
    attrs.stroke = stroke
    let sw: number | null = null
    if (stroke !== 'none') {
      sw = round(parseFloat(p['stroke-width'] ?? '1') / LINE, 4)
      attrs['stroke-linecap'] = p['stroke-linecap'] ?? 'butt'
      attrs['stroke-linejoin'] = p['stroke-linejoin'] ?? 'miter'
      if (p['stroke-miterlimit'] && attrs['stroke-linejoin'] === 'miter') attrs['stroke-miterlimit'] = round(+p['stroke-miterlimit'])
      if (p['stroke-dasharray'] && p['stroke-dasharray'] !== 'none') attrs['stroke-dasharray'] = roundNumbers(p['stroke-dasharray'])
      if (p['stroke-dashoffset']) attrs['stroke-dashoffset'] = round(+p['stroke-dashoffset'])
      if (p['stroke-opacity'] && +p['stroke-opacity'] < 1) attrs['stroke-opacity'] = round(+p['stroke-opacity'])
    }
    if (fill !== 'none') {
      if (p['fill-rule'] === 'evenodd') attrs['fill-rule'] = 'evenodd'
      if (p['fill-opacity'] && +p['fill-opacity'] < 1) attrs['fill-opacity'] = round(+p['fill-opacity'])
    }
    if (mine.opacity !== undefined && +mine.opacity < 1) attrs.opacity = round(+mine.opacity)
    if (mine.transform) attrs.transform = roundNumbers(mine.transform)
    if (fill === 'none' && stroke === 'none') return []
    // a stroked path with several lines in it becomes one path per line, so each can be drawn by itself
    if (el.tag === 'path' && fill === 'none') {
      const subs = subpaths(parsePath(String(attrs.d)))
      if (subs.length > 1) return subs.map(s => ({ leaf: { tag: 'path', attrs: { ...attrs, d: formatPath(s) }, sw } }))
    }
    return [{ leaf: { tag: el.tag, attrs, sw } }]
  }

  // Figma writes fill="none" on the frame itself: the root's presentation is inherited like a group's
  const tree = walk(root, {})
  if (colours.size > 1) fail(`it uses ${colours.size} colours (${[...colours].join(', ')}): an icon is one colour — cut details out of the shape (subtract) instead of painting them in another colour`)

  // the layer carries what most shapes share; each shape says only where it differs
  const leaves: Leaf[] = []
  const collect = (outs: Out[]) => { for (const o of outs) 'leaf' in o ? leaves.push(o.leaf) : collect((o[2] ?? []) as Out[]) }
  collect(tree)
  if (!leaves.length) fail('nothing is drawn in it')
  const common = <T,>(values: T[]): T | undefined => {
    const n = new Map<T, number>()
    for (const v of values) n.set(v, (n.get(v) ?? 0) + 1)
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0]
  }
  const layer: Record<string, string | number> = {}
  for (const k of ['fill', 'stroke', 'stroke-linecap', 'stroke-linejoin']) {
    const v = common(leaves.map(l => l.attrs[k]).filter(v => v !== undefined))
    if (v !== undefined) layer[k] = v
  }
  const sw = common(leaves.map(l => l.sw).filter((v): v is number => v !== null))
  if (sw !== undefined) layer.$sw = sw
  const finish = (outs: Out[]): Node[] => outs.map(o => {
    if (!('leaf' in o)) return [o[0], o[1], finish((o[2] ?? []) as Out[])] as Node
    const a: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(o.leaf.attrs)) if (layer[k] !== v) a[k] = v
    if (o.leaf.sw !== null && o.leaf.sw !== layer.$sw) a.$sw = o.leaf.sw
    return [o.leaf.tag, a] as Node
  })
  return { layer, nodes: finish(tree), parts, placeholder }
}

// ── writing ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const REACT: Record<string, string> = {
  'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit', 'stroke-dasharray': 'strokeDasharray', 'stroke-dashoffset': 'strokeDashoffset',
  'stroke-opacity': 'strokeOpacity', 'fill-rule': 'fillRule', 'clip-rule': 'clipRule', 'fill-opacity': 'fillOpacity',
}
/** the attributes as React props */
export const reactAttrs = (a: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(a).map(([k, v]) => [REACT[k] ?? k, v]))
export const reactNodes = (nodes: Node[]): Node[] =>
  nodes.map(([t, a, c]) => (c ? [t, reactAttrs(a), reactNodes(c)] : [t, reactAttrs(a)]))

/** a drawing as SVG markup (for the editor preview of each icon), at the given line width */
export function toSvg(d: Drawing, { size = 24, colour = 'currentColor', background, strokeWidth = LINE }: { size?: number; colour?: string; background?: string; strokeWidth?: number } = {}): string {
  const attrs = (a: Record<string, string | number>) =>
    Object.entries(a).map(([k, v]) => (k === '$sw' ? ` stroke-width="${round(+v * strokeWidth)}"` : ` ${k}="${v}"`)).join('')
  const nodes = (ns: Node[]): string => ns.map(([t, a, c]) => (c ? `<${t}${attrs(a)}>${nodes(c)}</${t}>` : `<${t}${attrs(a)}/>`)).join('')
  const bg = background ? `<rect width="24" height="24" rx="4" fill="${background}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" color="${colour}">${bg}<g${attrs(layerDefaults(d.layer))}>${nodes(d.nodes)}</g></svg>`
}
const layerDefaults = (layer: Record<string, string | number>) => ({ $sw: 1, ...layer })
