// What a motion works through: the drawing's layers and parts, their boxes, and a few ways to move them. Every
// attribute it changes is remembered and put back when the motion is over, so the icon at rest is always the drawing.

const SVG = 'http://www.w3.org/2000/svg'
const SHAPES = 'path, circle, ellipse, rect, line, polyline, polygon'

export type Vec = readonly [number, number]
export interface Box {
  x: number
  y: number
  w: number
  h: number
}
/** a move about an origin (in the icon's 24-unit grid): translate, rotate (degrees), scale */
export interface Pose {
  x?: number
  y?: number
  r?: number
  s?: number
  sx?: number
  sy?: number
  /** the point it turns and scales about */
  o?: Vec
}

const n = (v: number) => {
  const s = String(+v.toFixed(3))
  return s === '-0' ? '0' : s
}

let ids = 0

export class Ctx {
  /** the drawing (inside the layer): the whole-icon motions move this */
  readonly root: SVGGElement
  /**
   * how much of the motion shows, 1 → 0 while it's being let go: poses and fades ease back toward rest instead of
   * stopping where they are
   */
  weight = 1
  private touched = new Map<Element, Map<string, string | null>>()
  private boxes = new Map<Element, Box>()
  private lengths = new Map<Element, number>()
  private filters = new Map<Element, SVGFEGaussianBlurElement>()
  private temp: Element[] = []

  constructor(
    readonly svg: SVGSVGElement,
    /** the layer this drawing lives in (transitions move it) */
    readonly layer: SVGGElement,
  ) {
    this.root = layer.querySelector<SVGGElement>(':scope > [data-kz-root]') ?? layer
  }

  /** the drawing's layers of that name (Figma layer names), in drawing order */
  part(name: string): SVGGElement[] {
    return [...this.root.querySelectorAll<SVGGElement>(`[data-part="${name.replace(/"/g, '')}"]`)]
  }

  /** every drawn shape inside `el` */
  shapes(el: Element = this.root): SVGGeometryElement[] {
    return [...el.querySelectorAll<SVGGeometryElement>(SHAPES)].filter(s => !s.closest('[data-kz-temp]'))
  }

  /** the shapes inside `el` that are lines (stroked) */
  stroked(el: Element = this.root): SVGGeometryElement[] {
    return this.shapes(el).filter(s => (s.closest('[stroke]')?.getAttribute('stroke') ?? 'none') !== 'none')
  }

  /** its box in the icon's grid, measured at rest (the drawing's whole box leaves out the fx- effects) */
  box(el: SVGGraphicsElement): Box {
    let b = this.boxes.get(el)
    if (b) return b
    const of = (e: SVGGraphicsElement): Box | null => {
      try {
        const r = e.getBBox()
        return r.width || r.height ? { x: r.x, y: r.y, w: r.width, h: r.height } : null
      } catch {
        return null
      }
    }
    if (el === this.root) {
      const kids = [...el.children].filter(c => !(c.getAttribute('data-part') ?? '').startsWith('fx-')) as SVGGraphicsElement[]
      const bs = kids.map(of).filter((x): x is Box => x !== null)
      if (bs.length) {
        const x = Math.min(...bs.map(q => q.x))
        const y = Math.min(...bs.map(q => q.y))
        b = { x, y, w: Math.max(...bs.map(q => q.x + q.w)) - x, h: Math.max(...bs.map(q => q.y + q.h)) - y }
      }
    }
    b ??= of(el) ?? { x: 0, y: 0, w: 24, h: 24 }
    this.boxes.set(el, b)
    return b
  }

  /** a point of its box: [0, 0] its top left, [0.5, 0.5] its middle, [0.5, 1] the middle of its foot */
  at(el: SVGGraphicsElement, [fx, fy]: Vec): Vec {
    const b = this.box(el)
    return [b.x + fx * b.w, b.y + fy * b.h]
  }

  /** sets an attribute (null removes it), remembering what it was */
  set(el: Element, name: string, value: string | number | null) {
    let m = this.touched.get(el)
    if (!m) this.touched.set(el, (m = new Map()))
    if (!m.has(name)) m.set(name, el.getAttribute(name))
    if (value === null) el.removeAttribute(name)
    else el.setAttribute(name, typeof value === 'number' ? n(value) : value)
  }

  /** puts one attribute back the way the drawing has it */
  unset(el: Element, name: string) {
    const was = this.touched.get(el)?.get(name)
    if (was === undefined) return
    if (was === null) el.removeAttribute(name)
    else el.setAttribute(name, was)
  }

  private original(el: Element, name: string) {
    const m = this.touched.get(el)
    return m?.has(name) ? m.get(name)! : el.getAttribute(name)
  }

  /** moves it (an identity pose puts it back) */
  pose(el: Element, { x = 0, y = 0, r = 0, s = 1, sx = s, sy = s, o = [0, 0] }: Pose) {
    const w = this.weight
    if (w < 1) {
      x *= w
      y *= w
      r *= w
      sx = 1 + (sx - 1) * w
      sy = 1 + (sy - 1) * w
    }
    if (!x && !y && !r && sx === 1 && sy === 1) return this.unset(el, 'transform')
    const t = `translate(${n(x + o[0])} ${n(y + o[1])})${r ? ` rotate(${n(r)})` : ''}${sx !== 1 || sy !== 1 ? ` scale(${n(sx)} ${n(sy)})` : ''} translate(${n(-o[0])} ${n(-o[1])})`
    this.set(el, 'transform', t)
  }

  /** how much of it shows, on top of its own opacity */
  fade(el: Element, v: number) {
    const base = Number(this.original(el, 'opacity') ?? 1)
    const k = this.weight < 1 ? base + (v * (base || 1) - base) * this.weight : v * (base || 1)
    if (Math.abs(k - base) < 1e-4) return this.unset(el, 'opacity')
    this.set(el, 'opacity', k)
  }

  /** shows a stretch of a line, from `a` to `b` along it (0–1) */
  draw(el: SVGGeometryElement, a: number, b: number) {
    if (this.weight < 1) {
      a *= this.weight
      b = 1 - (1 - b) * this.weight
    }
    if (b - a >= 0.999) {
      this.unset(el, 'stroke-dasharray')
      this.unset(el, 'stroke-dashoffset')
      this.unset(el, 'visibility')
      return
    }
    if (b - a <= 0.001) return this.set(el, 'visibility', 'hidden')
    let L = this.lengths.get(el)
    if (L === undefined) {
      try {
        L = el.getTotalLength()
      } catch {
        L = 0
      }
      this.lengths.set(el, L)
    }
    this.unset(el, 'visibility')
    this.set(el, 'stroke-dasharray', `${n((b - a) * L)} ${n(L + 1)}`)
    this.set(el, 'stroke-dashoffset', n(-a * L))
  }

  /** blurs it (in grid units; 0 takes the blur off) */
  blur(el: Element, std: number) {
    if (std < 0.02) return this.unset(el, 'filter')
    let f = this.filters.get(el)
    if (!f) {
      const filter = document.createElementNS(SVG, 'filter')
      const id = `kz-blur-${++ids}`
      filter.setAttribute('id', id)
      for (const [k, v] of [['x', '-50%'], ['y', '-50%'], ['width', '200%'], ['height', '200%']]) filter.setAttribute(k, v)
      f = document.createElementNS(SVG, 'feGaussianBlur')
      filter.appendChild(f)
      this.defs().appendChild(filter)
      this.temp.push(filter)
      this.filters.set(el, f)
      this.set(el, 'filter', `url(#${id})`)
    }
    f.setAttribute('stdDeviation', n(std))
    if (!el.hasAttribute('filter')) this.set(el, 'filter', `url(#${f.parentElement!.id})`)
  }

  private defs() {
    let d = this.svg.querySelector(':scope > defs[data-kz-temp]')
    if (!d) {
      d = document.createElementNS(SVG, 'defs')
      d.setAttribute('data-kz-temp', '')
      this.svg.prepend(d)
      this.temp.push(d)
    }
    return d
  }

  /** a group of its own over the layers, for shapes that exist only while something moves (a morph) */
  overlay(): SVGGElement {
    const g = document.createElementNS(SVG, 'g')
    g.setAttribute('data-kz-temp', '')
    g.setAttribute('pointer-events', 'none')
    this.svg.appendChild(g)
    this.temp.push(g)
    return g
  }

  /** takes away what only the motion needed (filters, overlays); the attributes stay as they are */
  dispose() {
    for (const el of this.temp) el.remove()
    this.temp = []
    this.filters.clear()
  }

  /** puts every attribute back the way the drawing has it, and takes away what only the motion needed */
  restore() {
    for (const [el, m] of this.touched) {
      for (const [name, was] of m) {
        if (was === null) el.removeAttribute(name)
        else el.setAttribute(name, was)
      }
    }
    this.touched.clear()
    this.dispose()
  }
}
