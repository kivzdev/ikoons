// Shapes into shapes: each drawn shape is taken apart into its outlines, every outline walked into the same number of
// points, and the points of one drawing carried to the points of the other. Works on any two drawings — a shape with
// no partner shrinks into its middle (or grows out of it), one shape facing two splits in two (play → pause).

import { closed, formatPath, parsePath, subpaths } from './path.js'

const SVG = 'http://www.w3.org/2000/svg'
/** points per outline: enough that an outline drawn through them reads as the curve at any icon size */
export const POINTS = 96

export type Pt = [number, number]
export interface Outline {
  pts: Pt[]
  closed: boolean
}
export interface Shape {
  outlines: Outline[]
  /** what it's painted with (fill, stroke, its width…), to paint the shape in between */
  paint: Record<string, string>
  /** its part, when it has one: parts pair up by name */
  part: string | null
  centre: Pt
}

const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'opacity']

export const centreOf = (pts: Pt[]): Pt => {
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p[0]
    y += p[1]
  }
  return [x / pts.length, y / pts.length]
}

/** the shape `el` draws, in the coordinates of `space`, as it is on screen right now */
export function shapeOf(el: SVGGeometryElement, space: SVGGraphicsElement, n = POINTS): Shape {
  const m = space.getCTM()!.inverse().multiply(el.getCTM()!)
  const map = (p: DOMPoint): Pt => [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]
  const walk = (g: SVGGeometryElement, isClosed: boolean): Outline => {
    const L = g.getTotalLength()
    const pts: Pt[] = []
    for (let i = 0; i < n; i++) pts.push(map(g.getPointAtLength(L * (isClosed ? i / n : i / (n - 1)))))
    return { pts, closed: isClosed }
  }
  const outlines: Outline[] = []
  const tag = el.tagName.toLowerCase()
  const subs = tag === 'path' ? subpaths(parsePath(el.getAttribute('d') ?? '')) : null
  if (!subs || subs.length < 2) {
    outlines.push(walk(el, subs ? closed(subs[0] ?? []) : tag !== 'line' && tag !== 'polyline'))
  } else {
    // one outline at a time, measured on a stand-in path beside it (same place in the tree, same transforms)
    for (const s of subs) {
      const tmp = document.createElementNS(SVG, 'path')
      tmp.setAttribute('d', formatPath(s))
      for (const a of ['transform']) if (el.hasAttribute(a)) tmp.setAttribute(a, el.getAttribute(a)!)
      tmp.setAttribute('visibility', 'hidden')
      el.parentNode!.insertBefore(tmp, el)
      outlines.push(walk(tmp, closed(s)))
      tmp.remove()
    }
  }
  const paint: Record<string, string> = {}
  for (const k of PAINT) {
    const from = k === 'opacity' ? (el.hasAttribute(k) ? el : null) : el.closest(`[${k}]`)
    const v = from?.getAttribute(k)
    if (v != null) paint[k] = v
  }
  const part = el.closest('[data-part]')?.getAttribute('data-part') ?? null
  return { outlines, paint, part, centre: centreOf(outlines.flatMap(o => o.pts)) }
}

/**
 * pairs the things of one side with the other's: by name where both have the name; then the rest by order when
 * they're as many, otherwise each to its nearest; a lone one on one side faces all of the other side
 */
export function pairUp<T>(a: T[], b: T[], name: (t: T) => string | null, centre: (t: T) => Pt): [T | null, T | null][] {
  const out: [T | null, T | null][] = []
  const restA = [...a]
  const restB = [...b]
  for (const x of a) {
    const k = name(x)
    if (!k) continue
    const j = restB.findIndex(y => name(y) === k)
    if (j < 0) continue
    out.push([x, restB[j]])
    restA.splice(restA.indexOf(x), 1)
    restB.splice(j, 1)
  }
  const d = (p: Pt, q: Pt) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2
  if (restA.length === restB.length) restA.forEach((x, i) => out.push([x, restB[i]]))
  else if (restA.length === 1) restB.forEach(y => out.push([restA[0], y]))
  else if (restB.length === 1) restA.forEach(x => out.push([x, restB[0]]))
  else {
    // each of the larger side goes to its nearest on the smaller side; whatever on the smaller side is nobody's
    // nearest has no partner
    const [big, small, flip] = restA.length > restB.length ? [restA, restB, false] : [restB, restA, true]
    const taken = new Set<T>()
    for (const x of big) {
      if (!small.length) {
        out.push(flip ? [null, x] : [x, null])
        continue
      }
      const y = small.reduce((p, q) => (d(centre(q), centre(x)) < d(centre(p), centre(x)) ? q : p))
      taken.add(y)
      out.push(flip ? [y, x] : [x, y])
    }
    for (const y of small) if (!taken.has(y)) out.push(flip ? [y, null] : [null, y])
  }
  return out
}

/** `b`'s points re-ordered to follow `a`'s as closely as they can (same start, same way round) */
export function align(a: Outline, b: Outline): Pt[] {
  const N = a.pts.length
  const cost = (pts: Pt[], shift: number) => {
    let s = 0
    for (let i = 0; i < N; i++) {
      const p = a.pts[i]
      const q = pts[(i + shift) % N]
      s += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2
    }
    return s
  }
  const ways = [b.pts, [...b.pts].reverse()]
  let best = { pts: b.pts, shift: 0, cost: Infinity }
  for (const pts of ways) {
    for (let shift = 0; shift < (a.closed && b.closed ? N : 1); shift++) {
      const c = cost(pts, shift)
      if (c < best.cost) best = { pts, shift, cost: c }
    }
  }
  return Array.from({ length: N }, (_, i) => best.pts[(i + best.shift) % N])
}

/** a circle as an outline (a shape in between that no drawing has: the moon opening into a full disc) */
export const circle = (c: Pt, r: number, n = POINTS): Outline => ({
  pts: Array.from({ length: n }, (_, i): Pt => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]
  }),
  closed: true,
})

/** an outline collapsed into a point (for a shape with no partner) */
export const dot = (at: Pt, n: number, isClosed: boolean): Outline => ({ pts: Array.from({ length: n }, () => [at[0], at[1]] as Pt), closed: isClosed })

/** path data for points (closed outlines come back to their start) */
export function outlinePath(pts: Pt[], isClosed: boolean): string {
  let d = ''
  pts.forEach((p, i) => {
    d += `${i ? 'L' : 'M'}${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`
  })
  return isClosed ? `${d}Z` : d
}
