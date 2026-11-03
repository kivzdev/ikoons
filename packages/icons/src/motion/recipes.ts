// The motions, one recipe per kind of move; every icon in the catalog (icons/catalog.ts) is one of these with its own
// settings. All in the kivz.dev way: nothing in a straight line, a breath the other way before going, a few percent
// past on arriving, gravity for what falls, a dying swing only for what really swings. Units are the 24-unit grid.
//
// A recipe takes its settings and gives a Motion: given the drawing (Ctx), it returns a Run — a pure function of time —
// or, when the drawing lacks the layer it moves, a small pop of the whole icon instead.

import type { Ctx, Vec } from './ctx.js'
import type { Run } from './engine.js'
import {
  clamp01, cubicOut, length, landing, pop as popEase, quadIn, quadOut, quartIn, ring, seq, sineIn, sineInOut, sineOut,
  smoothstep, soft, spring, wheel, type Step,
} from './ease.js'

export type Motion = (c: Ctx) => Run

const targets = (c: Ctx, part?: string) => (part ? c.part(part) : [c.root])

// ── pushes ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** pressed in, then out a touch past its size and settled — the fallback for a drawing without the layer a motion needs */
export const pop = ({ s = 0.1, part, stagger = 0.06, origin = [0.5, 0.5] }: { s?: number; part?: string; stagger?: number; origin?: Vec } = {}): Motion => c => {
  const els = part && c.part(part).length ? c.part(part) : [c.root]
  const os = els.map(el => c.at(el, origin))
  const k: Step[] = [[0.09, 0, -1, sineInOut], [0.52, -1, 0, popEase]]
  return {
    duration: length(k) + stagger * (els.length - 1),
    frame(t) {
      els.forEach((el, i) => c.pose(el, { s: 1 + s * seq(t - i * stagger, k), o: os[i] }))
    },
  }
}

/** a push one way and back: a breath the other way, out, back with a spring (arrows, carets) */
export const nudge = ({ to = [2.5, 0], part, stagger = 0.06, r = 0, origin = [0.5, 0.5], alternate = false }: { to?: Vec; part?: string; stagger?: number; r?: number; origin?: Vec; alternate?: boolean } = {}): Motion => c => {
  const els = targets(c, part)
  if (!els.length) return pop()(c)
  const os = els.map(el => c.at(el, origin))
  const k: Step[] = [[0.1, 0, -0.22, sineInOut], [0.17, -0.22, 1, cubicOut], [0.5, 1, 0, spring]]
  return {
    duration: length(k) + stagger * (els.length - 1),
    frame(t) {
      els.forEach((el, i) => {
        const v = seq(t - i * stagger, k) * (alternate && i % 2 ? -1 : 1)
        c.pose(el, { x: to[0] * v, y: to[1] * v, r: r * v, o: os[i] })
      })
    },
  }
}

/**
 * out through an edge and back in from the other side (↗: "going out"): a breath back, away faster and faster,
 * gone before the edge; then in from the far side, settling a touch past. `arc` bows the way across it, `tilt`
 * leans it as it goes (a paper plane).
 */
export const exit = ({ to = [1, -1], part, dist = 7, arc = 0, tilt = 0 }: { to?: Vec; part?: string; dist?: number; arc?: number; tilt?: number } = {}): Motion => c => {
  const els = targets(c, part)
  if (!els.length) return pop()(c)
  const L = Math.hypot(to[0], to[1]) || 1
  const u: Vec = [to[0] / L, to[1] / L]
  const across: Vec = [-u[1], u[0]]
  const os = els.map(el => c.at(el, [0.5, 0.5]))
  const BACK = 0.1
  const OUT = 0.24
  const IN = 0.58
  return {
    duration: BACK + OUT + IN,
    frame(t) {
      let k: number
      let shown: number
      if (t < BACK) {
        k = -0.05 * sineInOut(t / BACK)
        shown = 1
      } else if (t < BACK + OUT) {
        const p = (t - BACK) / OUT
        k = -0.05 + 1.05 * quartIn(p)
        shown = 1 - sineIn(clamp01((p - 0.4) / 0.6))
      } else {
        const p = clamp01((t - BACK - OUT) / IN)
        k = -1 + spring(p)
        shown = sineOut(clamp01(p / 0.45))
      }
      const bow = arc * Math.sin(Math.PI * Math.min(1, Math.abs(k)))
      els.forEach((el, i) => {
        // (coming back in from the far side it still flies the same way: the lean goes with how far out it is)
        c.pose(el, { x: u[0] * k * dist + across[0] * bow, y: u[1] * k * dist + across[1] * bow, r: tilt * Math.abs(k), o: os[i] })
        c.fade(el, shown)
      })
    },
  }
}

// ── swings and turns ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * hangs from `origin` and swings, dying away in two or three swings (a bell, a tag on its string). `follow`: a part
 * hanging inside it (the clapper) is left behind, then swings further.
 */
export const swing = ({ origin = [0.5, 0], angle = 14, f = 2.2, decay = 2.6, part, follow, around }: { origin?: Vec; angle?: number; f?: number; decay?: number; part?: string; follow?: string; around?: 'root' } = {}): Motion => c => {
  const els = targets(c, part)
  if (!els.length) return pop()(c)
  const os = els.map(el => c.at(around === 'root' ? c.root : el, origin))
  const end = Math.log(Math.abs(angle) / 0.4) / decay
  const th = (t: number) => angle * ring(t, f, decay, end)
  const inside = follow ? c.part(follow) : []
  const io = inside.map(el => c.at(el, [0.5, 0]))
  return {
    duration: end + 0.08,
    frame(t) {
      els.forEach((el, i) => c.pose(el, { r: th(t), o: os[i] }))
      // (relative to the bell: where it would hang, a little late, minus the bell's own turn)
      inside.forEach((el, i) => c.pose(el, { r: 1.35 * th(t - 0.07) - th(t), o: io[i] }))
    },
  }
}

/**
 * turns by `angle` and settles a hair past it (a gear by a tooth, a plus by a quarter): the angle should leave it
 * looking as it did; `back` turns it there and back instead (for shapes that don't)
 */
export const turn = ({ angle = 60, origin = [0.5, 0.5], part, around, back = false, stagger = 0 }: { angle?: number; origin?: Vec; part?: string; around?: 'root'; back?: boolean; stagger?: number } = {}): Motion => c => {
  const els = targets(c, part)
  if (!els.length) return pop()(c)
  const os = els.map(el => c.at(around === 'root' ? c.root : el, origin))
  const wind = -Math.min(0.08, 5 / Math.abs(angle))
  const big = Math.abs(angle) > 150
  const k: Step[] = back
    ? [[0.09, 0, wind, sineInOut], [0.22, wind, 1, cubicOut], [0.52, 1, 0, spring]]
    : [[0.1, 0, wind, sineInOut], [big ? 0.95 : 0.62, wind, 1, big ? wheel : spring]]
  return {
    duration: length(k) + stagger * (els.length - 1),
    frame(t) {
      els.forEach((el, i) => c.pose(el, { r: angle * seq(t - i * stagger, k), o: os[i] }))
    },
  }
}

/**
 * goes round and round, never at an even speed (it swells and eases every turn) and never from a standstill to
 * full speed at once; asked to stop, it slows into the next full turn
 */
export const spin = ({ period = 0.95, sway = 0.55 }: { period?: number; sway?: number } = {}): Motion => c => {
  const o = c.at(c.root, [0.5, 0.5])
  const w = (2 * Math.PI) / period
  const turnAt = (t: number) => 360 * (t / period - (sway / (2 * Math.PI)) * Math.sin(w * t)) * smoothstep(0, 0.3, t) ** 0.5
  const speedAt = (t: number) => (turnAt(t + 0.001) - turnAt(t - 0.001)) / 0.002
  let stop: { t0: number; a0: number; v0: number; a1: number; d: number } | null = null
  return {
    duration: Infinity,
    finish(t) {
      const a0 = turnAt(t)
      const v0 = speedAt(t)
      // to the next full turn it can reach gently (at least a quarter on)
      const a1 = Math.ceil((a0 + Math.max(90, v0 * 0.2)) / 360) * 360
      const d = (2.2 * (a1 - a0)) / Math.max(v0, 60)
      stop = { t0: t, a0, v0, a1, d }
      return t + d
    },
    frame(t) {
      let a: number
      if (stop && t >= stop.t0) {
        // a curve from where it is at the speed it has to the turn it stops on, arriving at rest
        const p = clamp01((t - stop.t0) / stop.d)
        const h = stop.v0 * stop.d
        a = stop.a0 + h * (p - 2 * p * p + p * p * p) + (stop.a1 - stop.a0) * (3 * p * p - 2 * p * p * p)
      } else a = turnAt(t)
      c.pose(c.root, { r: a % 360, o })
    },
  }
}

/** flips over like a coin or a card (a 3D turn, as far as a flat drawing can), lifting a little at the middle */
export const flip = ({ part, turns = 1 }: { part?: string; turns?: number } = {}): Motion => c => {
  const els = targets(c, part)
  if (!els.length) return pop()(c)
  const os = els.map(el => c.at(el, [0.5, 0.5]))
  const k: Step[] = [[0.08, 0, -0.025, sineInOut], [0.85, -0.025, 1, spring]]
  return {
    duration: length(k),
    frame(t) {
      const v = seq(t, k)
      els.forEach((el, i) => c.pose(el, { sx: Math.cos(2 * Math.PI * turns * v), y: -1.2 * Math.sin(Math.PI * clamp01(v)), o: os[i] }))
    },
  }
}

/** a small loop on the spot, starting and ending still (looking for something) */
export const orbit = ({ r = 1.6, tilt = 0, dur = 0.95 }: { r?: number; tilt?: number; dur?: number } = {}): Motion => c => {
  const o = c.at(c.root, [0.5, 0.5])
  return {
    duration: dur,
    frame(t) {
      const a = 2 * Math.PI * sineInOut(clamp01(t / dur))
      c.pose(c.root, { x: -r * Math.sin(a), y: r * 0.9 * (1 - Math.cos(a)), r: -tilt * Math.sin(a), o })
    },
  }
}

/** shakes and settles: a rumble, a ringing phone, a warning */
export const jitter = ({ angle = 0, x = 0, f = 12, dur = 0.5, origin = [0.5, 0.5] }: { angle?: number; x?: number; f?: number; dur?: number; origin?: Vec } = {}): Motion => c => {
  const o = c.at(c.root, origin)
  return {
    duration: dur,
    frame(t) {
      const env = smoothstep(0, 0.06, t) * (1 - smoothstep(dur * 0.3, dur, t))
      const w = 2 * Math.PI * f * t
      c.pose(c.root, { x: x * Math.sin(w) * env, r: angle * Math.sin(w + 0.6) * env, o })
    },
  }
}

/** floats off a little and back, slowly (a cloud) */
export const drift = ({ x = 1.6, y = -0.5, dur = 1.6 }: { x?: number; y?: number; dur?: number } = {}): Motion => c => ({
  duration: dur,
  frame(t) {
    const u = clamp01(t / dur)
    c.pose(c.root, { x: x * Math.sin(Math.PI * sineInOut(u)), y: y * Math.sin(2 * Math.PI * u) })
  },
})

// ── bodies ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** a heartbeat: swells, eases back, swells again a little less, settles (`beats` 1: one swell; a negative `scale` shrinks) */
export const beat = ({ scale = 0.16, beats = 2, origin = [0.5, 0.55] }: { scale?: number; beats?: number; origin?: Vec } = {}): Motion => c => {
  const o = c.at(c.root, origin)
  const k: Step[] = beats > 1
    ? [[0.11, 0, 1, cubicOut], [0.13, 1, -0.25, sineInOut], [0.11, -0.25, 0.75, cubicOut], [0.48, 0.75, 0, spring]]
    : [[0.08, 0, -0.18, sineInOut], [0.14, -0.18, 1, cubicOut], [0.5, 1, 0, spring]]
  return { duration: length(k), frame(t) { c.pose(c.root, { s: 1 + scale * seq(t, k), o }) } }
}

/**
 * stretches from where it's held and settles like a jelly: one stretch, a smaller squash, still (a bookmark pulled
 * down from its top). It keeps about its volume: longer is narrower.
 */
export const jelly = ({ origin = [0.5, 0], axis = 'y', amount = 0.14, part, f = 2.6, decay = 6 }: { origin?: Vec; axis?: 'x' | 'y'; amount?: number; part?: string; f?: number; decay?: number } = {}): Motion => c => {
  const els = targets(c, part)
  if (!els.length) return pop()(c)
  const os = els.map(el => c.at(el, origin))
  const end = Math.log(amount / 0.002) / decay
  return {
    duration: end,
    frame(t) {
      const e = amount * ring(t, f, decay, end)
      const along = 1 + e
      const across = 1 / (1 + 0.5 * e)
      els.forEach((el, i) => c.pose(el, axis === 'y' ? { sx: across, sy: along, o: os[i] } : { sx: along, sy: across, o: os[i] }))
    },
  }
}

/**
 * a hop on gravity: crouches, jumps `h`, comes down and bounces (each bounce a fifth as high), squashing on every
 * landing by how fast it came down and stretching as it flies. `sink`: on its last landing it sinks in (a pin) and
 * comes back up. Parts hop one after another.
 */
export const hop = ({ h = 3, bounces = 2, part, stagger = 0.07, sink = 0, tilt = 0 }: { h?: number; bounces?: number; part?: string; stagger?: number; sink?: number; tilt?: number } = {}): Motion => c => {
  const els = targets(c, part)
  if (!els.length) return pop()(c)
  const g = (2 * 3) / 0.28 ** 2 // a 3-unit hop rises for 0.28 s
  const e = 0.45
  const CROUCH = 0.09
  const heights = [h]
  for (let i = 0; i < bounces; i++) heights.push(heights[i] * e * e)
  const flights = heights.map(x => 2 * Math.sqrt((2 * x) / g))
  const starts: number[] = []
  let at = CROUCH
  for (const d of flights) {
    starts.push(at)
    at += d
  }
  const SETTLE = 0.34
  const v0 = Math.sqrt(2 * g * h)
  const os = els.map(el => c.at(el, [0.5, 1]))
  const one = at + SETTLE
  // the squash a landing at speed v gives: it keeps going down into itself for a moment (from nothing, fast), springs
  // back up a little past, and is still
  const squash = (tau: number, v: number) =>
    tau <= 0 || tau >= SETTLE ? 0 : ((0.2 * v) / v0) * Math.sin(tau * 39) * Math.exp(-tau / 0.06) * (1 - smoothstep(SETTLE * 0.5, SETTLE, tau))
  const pose = (t: number) => {
    if (t <= 0 || t >= one) return { y: 0, sq: 0, st: 0, r: 0 }
    if (t < CROUCH) return { y: 0, sq: 0.1 * sineInOut(t / CROUCH), st: 0, r: 0 }
    let y = 0
    let st = 0
    let r = 0
    let sq = 0
    for (let i = 0; i < flights.length; i++) {
      const tau = t - starts[i]
      const v = Math.sqrt(2 * g * heights[i])
      if (tau >= 0 && tau < flights[i]) {
        y = -(v * tau - (g * tau * tau) / 2)
        st = 0.07 * (Math.abs(v - g * tau) / v0)
        r = i === 0 ? tilt * Math.sin((Math.PI * tau) / flights[i]) : 0
      }
      // (the crouch lets go as it takes off; each landing squashes)
      if (i === 0) sq += 0.1 * (1 - smoothstep(0, 0.06, tau))
      sq += squash(t - (starts[i] + flights[i]), v)
    }
    if (sink) {
      const tau = t - at
      if (tau > 0) y += sink * Math.sin(Math.PI * clamp01(tau / 0.22)) * (1 - smoothstep(0.1, SETTLE, tau)) ** 0.5
    }
    return { y, sq, st, r }
  }
  return {
    duration: one + stagger * (els.length - 1),
    frame(t) {
      els.forEach((el, i) => {
        const p = pose(t - i * stagger)
        const sy = 1 - p.sq + p.st
        c.pose(el, { y: p.y, r: p.r, sy, sx: 1 / (1 + 0.6 * (sy - 1)), o: os[i] })
      })
    },
  }
}

/** a part lifts and is set back down, a hair past (a roof, a lid, a shackle) */
export const lift = ({ part, y = -2, tilt = 0 }: { part?: string; y?: number; tilt?: number } = {}): Motion => c => {
  const els = part ? c.part(part) : []
  if (!els.length) return hop({ h: Math.abs(y), bounces: 1 })(c)
  const os = els.map(el => c.at(el, [0.5, 1]))
  const k: Step[] = [[0.07, 0, -0.1, sineInOut], [0.2, -0.1, 1, cubicOut], [0.06, 1, 1, sineInOut], [0.44, 1, 0, landing]]
  return {
    duration: length(k),
    frame(t) {
      const v = seq(t, k)
      els.forEach((el, i) => c.pose(el, { y: y * v, r: tilt * v, o: os[i] }))
    },
  }
}

/**
 * a part opens on its hinge and shuts again with a bounce (a bin's lid). `flip`: it folds back over its top edge
 * instead (an envelope's flap); `inner` rises out while it's open and goes back before it shuts.
 */
export const open = ({ part, origin = [0, 1], angle = -22, flip: folds = false, rise = 0, inner, hold = 0.12 }: { part?: string; origin?: Vec; angle?: number; flip?: boolean; rise?: number; inner?: string; hold?: number } = {}): Motion => c => {
  const lid = part ? c.part(part) : []
  if (!lid.length) return pop()(c)
  const os = lid.map(el => c.at(el, origin))
  const letter = inner ? c.part(inner) : []
  const k: Step[] = [[0.08, 0, -0.06, sineInOut], [0.24, -0.06, 1, cubicOut], [hold, 1, 1, sineInOut], [0.2, 1, 0, quadIn], [0.08, 0, 0.12, quadOut], [0.08, 0.12, 0, quadIn]]
  const up: Step[] = [[0.22, 0, 1, cubicOut], [hold * 0.5, 1, 1, sineInOut], [0.14, 1, 0, sineIn]]
  return {
    duration: length(k) + 0.04,
    frame(t) {
      const v = seq(t, k)
      // (folding back: it shortens through its hinge line and comes out the other side, 0.55 of itself)
      lid.forEach((el, i) => c.pose(el, folds ? { sy: 1 - 1.55 * v, o: os[i] } : { r: angle * v, y: -rise * Math.max(0, v), o: os[i] }))
      const l = seq(t - 0.12, up)
      letter.forEach(el => {
        c.pose(el, { y: -(folds ? rise : 2) * l })
        c.fade(el, clamp01(l * 1.6))
      })
    },
  }
}

// ── drawing ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * the lines are drawn again: they go back to where they start (quickly), then are drawn one after another.
 * `from: 'center'` grows each line from its middle out (an ×); `parts` draws those parts in order, each once the
 * one before is done (`sequential`) — a circle, then its tick.
 */
export const draw = ({ part, parts, from = 'start', stagger = 0.08, sequential = false }: { part?: string; parts?: string[]; from?: 'start' | 'center'; stagger?: number; sequential?: boolean } = {}): Motion => c => {
  const groups = parts ? parts.map(p => c.part(p).flatMap(el => c.stroked(el))).filter(g => g.length) : [targets(c, part).flatMap(el => c.stroked(el))]
  const lines = groups.flat()
  if (!lines.length) return pop()(c)
  const OUT = 0.16
  const IN = 0.42
  const starts: number[] = []
  let at = OUT + 0.02
  for (const g of groups) {
    g.forEach((_, i) => starts.push(at + i * stagger))
    at += sequential ? IN * 0.8 + stagger * (g.length - 1) : stagger * g.length
  }
  return {
    duration: Math.max(...starts) + IN,
    frame(t) {
      lines.forEach((el, i) => {
        const k = t < OUT ? 1 - sineIn(t / OUT) : soft(clamp01((t - starts[i]) / IN))
        if (from === 'center') c.draw(el, 0.5 - k / 2, 0.5 + k / 2)
        else c.draw(el, 0, k)
      })
    },
  }
}

/** waves go and come back one after another from the source outwards (a speaker, wifi) */
export const waves = ({ part = 'wave', origin = [0.25, 0.5], stagger = 0.09 }: { part?: string; origin?: Vec; stagger?: number } = {}): Motion => c => {
  const ws = c.part(part)
  if (!ws.length) return pop()(c)
  const o = c.at(c.root, origin)
  const OUT = 0.12
  const IN = 0.42
  return {
    duration: OUT + 0.04 + stagger * (ws.length - 1) + IN,
    frame(t) {
      ws.forEach((el, i) => {
        const at = OUT + 0.04 + i * stagger
        if (t < at) {
          const g = sineIn(clamp01(t / OUT))
          c.pose(el, { s: 1 - 0.15 * g, o })
          c.fade(el, 1 - g)
        } else {
          const p = clamp01((t - at) / IN)
          c.pose(el, { s: 0.7 + 0.3 * popEase(p), o })
          c.fade(el, sineOut(clamp01(p / 0.5)))
        }
      })
    },
  }
}

/** parts shrink away together and grow back one by one, a touch past (chart bars, a battery's level) */
export const grow = ({ part, from = 'bottom', stagger = 0.06 }: { part?: string; from?: 'bottom' | 'top' | 'left' | 'center'; stagger?: number } = {}): Motion => c => {
  const els = part ? c.part(part) : []
  if (!els.length) return pop()(c)
  const origin: Vec = from === 'bottom' ? [0.5, 1] : from === 'top' ? [0.5, 0] : from === 'left' ? [0, 0.5] : [0.5, 0.5]
  const os = els.map(el => c.at(el, origin))
  const OUT = 0.12
  const IN = 0.5
  return {
    duration: OUT + 0.03 + stagger * (els.length - 1) + IN,
    frame(t) {
      els.forEach((el, i) => {
        const at = OUT + 0.03 + i * stagger
        const v = t < at ? 1 - 0.85 * sineIn(clamp01(t / OUT)) : 0.15 + 0.85 * popEase(clamp01((t - at) / IN))
        c.pose(el, from === 'left' ? { sx: v, o: os[i] } : { sy: v, o: os[i] })
      })
    },
  }
}

/** two parts push apart and come back together (brackets, two sheets, a link) — or one part's layers fan out */
export const spread = ({ parts, part, dist = 1.5, axis = 'x', dir }: { parts?: [string, string]; part?: string; dist?: number; axis?: 'x' | 'y'; dir?: Vec } = {}): Motion => c => {
  let items: { el: SVGGElement; v: Vec }[]
  const d: Vec = dir ?? (axis === 'x' ? [-1, 0] : [0, -1])
  const L = Math.hypot(d[0], d[1]) || 1
  const u: Vec = [d[0] / L, d[1] / L]
  if (parts) {
    const a = c.part(parts[0])
    const b = c.part(parts[1])
    if (!a.length || !b.length) return pop()(c)
    items = [...a.map(el => ({ el, v: u })), ...b.map(el => ({ el, v: [-u[0], -u[1]] as Vec }))]
  } else {
    const els = part ? c.part(part) : []
    if (els.length < 2) return pop()(c)
    items = els.map((el, i) => {
      const m = i - (els.length - 1) / 2
      return { el, v: [u[0] * m, u[1] * m] as Vec }
    })
  }
  const k: Step[] = [[0.08, 0, -0.2, sineInOut], [0.16, -0.2, 1, cubicOut], [0.06, 1, 1, sineInOut], [0.48, 1, 0, spring]]
  return {
    duration: length(k),
    frame(t) {
      const v = seq(t, k) * dist
      for (const it of items) c.pose(it.el, { x: it.v[0] * v, y: it.v[1] * v })
    },
  }
}

/** closes and opens (an eye; `opacity`: blinks out and in, like a cursor) */
export const blink = ({ part, opacity = false, times = 1, stagger = 0 }: { part?: string; opacity?: boolean; times?: number; stagger?: number } = {}): Motion => c => {
  const els = part ? c.part(part) : [c.root]
  if (!els.length) return pop()(c)
  const os = els.map(el => c.at(el, [0.5, 0.5]))
  const SHUT = opacity ? 0.12 : 0.09
  const OPEN = opacity ? 0.24 : 0.22
  const one = SHUT + OPEN + (opacity ? 0.1 : 0)
  return {
    duration: one * times + stagger * (els.length - 1),
    frame(t) {
      els.forEach((el, i) => {
        const u = t - i * stagger
        const nth = Math.floor(u / one)
        const p = u - nth * one
        let shut = 0
        if (u > 0 && nth < times) shut = p < SHUT ? sineIn(p / SHUT) : 1 - spring(clamp01((p - SHUT) / OPEN))
        if (opacity) c.fade(el, 1 - shut)
        else c.pose(el, { sy: 1 - 0.9 * shut, o: os[i] })
      })
    },
  }
}

/**
 * the big one swells and turns, the small ones pop back one after another (a sparkle); `glints`: lines at its tips
 * (fx- layers, hidden at rest) flash out one after another (a star)
 */
export const twinkle = ({ main, small, glints, rot = 14, scale = 0.12 }: { main?: string; small?: string; glints?: string; rot?: number; scale?: number } = {}): Motion => c => {
  const smalls = small ? c.part(small) : []
  const big = main ? c.part(main) : smalls.length ? [] : [c.root]
  const gl = glints ? c.part(glints) : []
  if (!big.length && !smalls.length) return pop()(c)
  const k: Step[] = [[0.08, 0, -0.15, sineInOut], [0.18, -0.15, 1, cubicOut], [0.5, 1, 0, spring]]
  const ob = big.map(el => c.at(el, [0.5, 0.5]))
  const os = smalls.map(el => c.at(el, [0.5, 0.5]))
  const centre = c.at(c.root, [0.5, 0.55])
  const SMALL_AT = 0.16
  return {
    duration: Math.max(length(k), SMALL_AT + 0.07 * smalls.length + 0.52, gl.length ? 0.2 + 0.05 * gl.length + 0.4 : 0),
    frame(t) {
      const v = seq(t, k)
      big.forEach((el, i) => c.pose(el, { s: 1 + scale * v, r: rot * v, o: ob[i] }))
      smalls.forEach((el, i) => {
        const at = SMALL_AT + i * 0.07
        const s = t < at ? 1 - sineIn(clamp01(t / 0.1)) : popEase(clamp01((t - at) / 0.52))
        c.pose(el, { s: Math.max(0.001, s), o: os[i] })
      })
      gl.forEach((el, i) => {
        const p = clamp01((t - 0.2 - i * 0.05) / 0.4)
        c.pose(el, { s: 0.85 + 0.2 * sineOut(p), o: centre })
        c.fade(el, Math.sin(Math.PI * p) ** 0.8)
      })
    },
  }
}

// ── putting motions together ─────────────────────────────────────────────────────────────────────────────────────────

/** several motions at once, on different parts (a robot's antenna swings while its eyes blink) */
export const combo = (...motions: Motion[]): Motion => c => {
  const runs = motions.map(m => m(c))
  return {
    duration: Math.max(...runs.map(r => r.duration)),
    frame(t) {
      for (const r of runs) r.frame(Math.min(t, r.duration))
    },
  }
}

/** a motion that starts `delay` seconds in */
export const later = (delay: number, m: Motion): Motion => c => {
  const r = m(c)
  return { duration: delay + r.duration, frame: t => r.frame(Math.max(0, t - delay)) }
}

/** a run being let go: it carries on as it was, while what shows of it eases back to rest over `d` seconds */
export function letGo(run: Run, c: Ctx, from: number, d = 0.16): Run {
  return {
    duration: Math.min(run.duration, from + d),
    frame(t) {
      c.weight = 1 - soft(clamp01((t - from) / d))
      run.frame(t)
    },
  }
}

/** under reduced motion, a loop only breathes: its opacity swells and eases, nothing moves */
export const breathe = (): Motion => c => {
  let stopAt = Infinity
  const at = (t: number) => 0.62 + 0.38 * (0.5 + 0.5 * Math.cos((2 * Math.PI * t) / 1.6))
  return {
    duration: Infinity,
    finish(t) {
      stopAt = t
      return t + 0.3
    },
    frame(t) {
      const v = at(t)
      c.fade(c.root, t <= stopAt ? v : v + (1 - v) * soft(clamp01((t - stopAt) / 0.3)))
    },
  }
}
