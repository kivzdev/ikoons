// How one drawing becomes another: a change of weight (outline → filled), or one icon becoming another in a <Swap>
// (play → pause). A transition is a Run over two drawings, a pure function of time like the motions — a change of mind
// halfway plays it backwards from where it is. Without one of its own, a pair blurs out and in where it stands
// (kivz.dev's text swap: never a slide).

import type { Ctx } from './ctx.js'
import type { Run } from './engine.js'
import { clamp01, length, pop as popEase, quadIn, seq, sineIn, sineInOut, sineOut, soft, spring, swift, type Step } from './ease.js'
import { POINTS, align, centreOf, circle, dot, outlinePath, pairUp, shapeOf, type Outline, type Pt, type Shape } from './morph.js'
import type { Motion } from './recipes.js'

const SVG = 'http://www.w3.org/2000/svg'

/** the drawing that's leaving and the one that's coming */
export interface Between {
  from: Ctx
  to: Ctx
}
export type Transition = (b: Between) => Run

/** out where it stands (a blur and a fade, 0.2 s), then the new one in where it stood (0.45 s) */
export const swap = ({ blur = 2.4 }: { blur?: number } = {}): Transition => ({ from, to }) => ({
  duration: 0.65,
  frame(t) {
    const o = sineIn(clamp01(t / 0.2))
    const i = sineOut(clamp01((t - 0.2) / 0.45))
    from.fade(from.layer, 1 - o)
    from.blur(from.layer, blur * o)
    to.fade(to.layer, i)
    to.blur(to.layer, blur * (1 - i))
  },
})

/** for reduced motion: one fades as the other comes, nothing moves */
export const fade = (): Transition => ({ from, to }) => ({
  duration: 0.24,
  frame(t) {
    from.fade(from.layer, 1 - sineIn(clamp01(t / 0.14)))
    to.fade(to.layer, sineOut(clamp01((t - 0.06) / 0.18)))
  },
})

/**
 * outline → filled: the filled drawing grows out of the middle of the outline, a touch past, and the outline goes once
 * it's covered; the icon's own motion plays on it as it lands (a heart beats as it fills, a star turns)
 */
export const fill = (motion?: Motion): Transition => ({ from, to }) => {
  const o = to.at(to.root, [0.5, 0.5])
  const own = motion?.(to)
  const mine = own && Number.isFinite(own.duration) ? own : null
  // (the motion starts once the fill has nearly landed, so the two don't add up to one big swell)
  const LEAD = 0.26
  return {
    duration: Math.max(0.5, mine ? LEAD + mine.duration : 0),
    frame(t) {
      to.pose(to.layer, { s: 0.35 + 0.65 * spring(clamp01(t / 0.42)), o })
      to.fade(to.layer, sineOut(clamp01(t / 0.12)))
      from.fade(from.layer, 1 - sineIn(clamp01((t - 0.2) / 0.16)))
      mine?.frame(Math.max(0, t - LEAD))
    },
  }
}

/** filled → outline: the outline is there underneath at once; the fill swells a hair, then shrinks into its middle */
export const unfill = (): Transition => ({ from, to }) => {
  const o = from.at(from.root, [0.5, 0.5])
  // (quick: it's an answer to a press — a breath, then it goes, already moving by a tenth of a second)
  const k: Step[] = [[0.06, 1, 1.03, sineInOut], [0.22, 1.03, 0.35, quadIn]]
  return {
    duration: length(k),
    frame(t) {
      to.fade(to.layer, sineOut(clamp01(t / 0.16)))
      from.pose(from.layer, { s: seq(t, k), o })
      from.fade(from.layer, 1 - sineIn(clamp01((t - 0.14) / 0.14)))
    },
  }
}

/**
 * the shapes in between two sets of shapes, as paths in `g`: `at(k, up)` draws them `k` of the way (k may pass 1 a
 * little on a springy curve). `spin` turns them as they go and still lands exactly on the end; `lift` raises a part's
 * shape by `up` times its amount.
 */
function blend(A: Shape[], B: Shape[], g: SVGGElement, { spin = 0, lift }: { spin?: number; lift?: Record<string, number> } = {}) {
  const [cx, cy] = centreOf(B.flatMap(s => s.outlines.flatMap(o => o.pts)))
  const turn = (p: Pt, deg: number): Pt => {
    const a = (deg * Math.PI) / 180
    const x = p[0] - cx
    const y = p[1] - cy
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]
  }
  const items = pairUp(A, B, s => s.part, s => s.centre).map(([a, z]) => {
    const shape = (z ?? a)!
    const path = document.createElementNS(SVG, 'path')
    for (const [k, v] of Object.entries(shape.paint)) path.setAttribute(k, v)
    g.appendChild(path)
    const lines = pairUp<Outline>(a?.outlines ?? [], z?.outlines ?? [], () => null, o => centreOf(o.pts)).map(([x, y]) => {
      const p = x ?? dot(centreOf(y!.pts), POINTS, y!.closed)
      const q = y ?? dot(centreOf(x!.pts), POINTS, x!.closed)
      // (the end is turned back by the spin, so turning the in-between by it lands exactly on the end)
      return { from: p.pts, to: align(p, q).map(pt => (spin ? turn(pt, -spin) : pt)), closed: q.closed }
    })
    return { path, lines, lift: (shape.part && lift?.[shape.part]) || 0 }
  })
  return (k: number, up = 0) => {
    const r = spin * k
    for (const it of items) {
      let d = ''
      for (const l of it.lines) {
        const pts = l.from.map((p, i): Pt => {
          const q = l.to[i]
          let pt: Pt = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]
          if (r) pt = turn(pt, r)
          return [pt[0], pt[1] - it.lift * up]
        })
        d += outlinePath(pts, l.closed)
      }
      it.path.setAttribute('d', d)
    }
  }
}

/**
 * one drawing's shapes become the other's (the play triangle splits into the two pause bars). `spin` turns the shape
 * as it changes (and it still lands exactly); `lift` raises a part's shape on the way (a lock's shackle).
 */
export const morph = ({ dur = 0.5, spin = 0, lift }: { dur?: number; spin?: number; lift?: Record<string, number> } = {}): Transition => b => {
  const { from, to } = b
  const A = from.shapes().map(el => shapeOf(el, from.layer))
  const B = to.shapes().map(el => shapeOf(el, to.layer))
  if (!A.length || !B.length) return swap()(b)
  const g = to.overlay()
  const at = blend(A, B, g, { spin, lift })
  return {
    duration: dur,
    frame(t) {
      const mid = t > 0 && t < dur
      from.fade(from.layer, t <= 0 ? 1 : 0)
      to.fade(to.layer, t >= dur ? 1 : 0)
      to.set(g, 'visibility', mid ? 'visible' : 'hidden')
      if (mid) at(spring(t / dur), Math.sin(Math.PI * (t / dur)))
    },
  }
}

/**
 * moon → sun (Kivz: "ay dönerek güneşe açılır, ışınlar sırayla belirir"): the crescent turns as it opens — its bite
 * closing — into a full disc its own size, the disc settles into the sun's core, and the rays come out of it one
 * after another
 */
export const sunrise = ({ spin = 100 }: { spin?: number } = {}): Transition => b => {
  const { from, to } = b
  const cores = to.part('core')
  const A = from.shapes().map(el => shapeOf(el, from.layer))
  const B = cores.flatMap(p => to.shapes(p)).map(el => shapeOf(el, to.layer))
  if (!A.length || !B.length) return swap()(b)
  // the full disc in between: as big as the moon, where the moon is
  const pts = A.flatMap(s => s.outlines.flatMap(o => o.pts))
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const c: Pt = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  const disc: Shape = { outlines: [circle(c, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2)], paint: A[0].paint, part: null, centre: c }
  const g1 = to.overlay()
  const g2 = to.overlay()
  const opening = blend(A, [disc], g1, { spin })
  const settling = blend([disc], B, g2)
  const OPEN = 0.34
  const SETTLE = 0.3
  const rays = to.part('ray')
  const o = to.at(to.root, [0.5, 0.5])
  const AT = OPEN + 0.04
  const EACH = 0.04
  const IN = 0.5
  return {
    duration: Math.max(OPEN + SETTLE, AT + EACH * (rays.length - 1) + IN),
    frame(t) {
      const one = t > 0 && t < OPEN
      const two = t >= OPEN && t < OPEN + SETTLE
      from.fade(from.layer, t <= 0 ? 1 : 0)
      for (const el of cores) to.fade(el, t >= OPEN + SETTLE ? 1 : 0)
      to.set(g1, 'visibility', one ? 'visible' : 'hidden')
      to.set(g2, 'visibility', two ? 'visible' : 'hidden')
      if (one) opening(sineInOut(t / OPEN))
      if (two) settling(spring((t - OPEN) / SETTLE))
      rays.forEach((el, i) => {
        const p = clamp01((t - AT - i * EACH) / IN)
        to.pose(el, { s: Math.max(0.001, popEase(p)), o })
        to.fade(el, sineOut(clamp01(p / 0.3)))
      })
    },
  }
}

/** lock → open: the shackle rises as it changes shape and comes down open, the body stays */
export const unlock = (): Transition => morph({ dur: 0.52, lift: { shackle: 1.6 } })

/**
 * eye → eye-slash (and bell, microphone): the line is drawn across it. `blink`: first the eye shuts — and while it's
 * shut it becomes the other drawing — and opens again
 */
export const slash = ({ blink = false }: { blink?: boolean } = {}): Transition => ({ from, to }) => {
  const lines = to.part('slash').flatMap(p => to.stroked(p))
  const fo = from.at(from.root, [0.5, 0.5])
  const too = to.at(to.root, [0.5, 0.5])
  const SHUT = 0.11
  const OPEN = 0.24
  const SWAP = 0.16
  const DRAW = 0.36
  const at = blink ? SHUT + OPEN - 0.04 : SWAP
  return {
    duration: at + DRAW,
    frame(t) {
      if (blink) {
        from.pose(from.layer, { sy: 1 - 0.92 * sineIn(clamp01(t / SHUT)), o: fo })
        from.fade(from.layer, t < SHUT ? 1 : 0)
        to.fade(to.layer, t < SHUT ? 0 : 1)
        to.pose(to.layer, { sy: 0.08 + 0.92 * spring(clamp01((t - SHUT) / OPEN)), o: too })
      } else {
        from.fade(from.layer, 1 - sineIn(clamp01(t / SWAP)))
        to.fade(to.layer, sineOut(clamp01(t / SWAP)))
      }
      const k = soft(clamp01((t - at) / DRAW))
      for (const l of lines) to.draw(l, 0, k)
    },
  }
}

/** copy → check: the two sheets slide into one, it goes, and the tick is drawn */
export const copied = (): Transition => ({ from, to }) => {
  const back = from.part('back')
  const front = from.part('front')
  let dx = 0
  let dy = 0
  if (back.length && front.length) {
    const a = from.box(back[0])
    const z = from.box(front[0])
    dx = z.x - a.x
    dy = z.y - a.y
  }
  const o = from.at(from.root, [0.5, 0.5])
  const oz = to.at(to.root, [0.5, 0.5])
  const ticks = to.stroked()
  const SLIDE = 0.24
  const GO = 0.16
  const DRAW = 0.42
  const at = SLIDE + GO - 0.08
  return {
    duration: at + DRAW,
    frame(t) {
      const m = swift(clamp01(t / SLIDE))
      for (const el of back) from.pose(el, { x: dx * m, y: dy * m })
      const g = sineIn(clamp01((t - SLIDE + 0.02) / GO))
      from.pose(from.layer, { s: 1 - 0.18 * g, o })
      from.fade(from.layer, 1 - g)
      to.fade(to.layer, t > at ? 1 : 0)
      const k = soft(clamp01((t - at) / DRAW))
      if (ticks.length) for (const l of ticks) to.draw(l, 0, k)
      else to.pose(to.layer, { s: 0.6 + 0.4 * popEase(k), o: oz })
    },
  }
}
