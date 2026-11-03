// The curves everything moves on: the same ones as kivz.dev (its GSAP eases), as plain functions, exact — the cubic
// ones solved like CSS's cubic-bezier, the springy ones read off the same Bézier paths GSAP's CustomEase uses.
// Nothing here moves in a straight line; a curve is picked by the job (arriving, leaving, settling, snapping).

/** progress 0–1 in, eased progress out (the springy ones pass 1 a little on the way) */
export type Ease = (p: number) => number

/** cubic-bezier(x1, y1, x2, y2), solved for time the way CSS does */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const x = (t: number) => ((ax * t + bx) * t + cx) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  const y = (t: number) => ((ay * t + by) * t + cy) * t
  return p => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    let t = p
    for (let i = 0; i < 8; i++) {
      const e = x(t) - p
      if (Math.abs(e) < 1e-7) return y(t)
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    let lo = 0
    let hi = 1
    t = p
    for (let i = 0; i < 40; i++) {
      const v = x(t)
      if (Math.abs(v - p) < 1e-7) break
      if (v < p) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return y(t)
  }
}

/** a curve drawn as cubic Bézier segments from 0,0 to 1,1 — GSAP CustomEase's "M0,0 C…" form */
export function curve(def: string): Ease {
  const n = (def.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
  const segs: number[][] = []
  for (let i = 2; i + 5 < n.length; i += 6) segs.push([n[i - 2], n[i - 1], ...n.slice(i, i + 6)])
  const at = (s: number[], t: number, o: number) => {
    const u = 1 - t
    return u * u * u * s[o] + 3 * u * u * t * s[o + 2] + 3 * u * t * t * s[o + 4] + t * t * t * s[o + 6]
  }
  return p => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    const s = segs.find(s => p <= s[6]) ?? segs[segs.length - 1]
    let lo = 0
    let hi = 1
    let t = 0.5
    for (let i = 0; i < 40; i++) {
      t = (lo + hi) / 2
      if (at(s, t, 0) < p) lo = t
      else hi = t
    }
    return at(s, t, 1)
  }
}

/** the default ease-out: colour, fades, settling things */
export const soft = bezier(0.22, 1, 0.36, 1)
/** arrives at speed and settles (entrances) */
export const settle = bezier(0.05, 0.85, 0.3, 1)
/** an in-out for moves from one place to another */
export const swift = bezier(0.65, 0, 0.35, 1)
/** slid by hand: going at once but gently, an even speed, a friction stop */
export const slide = bezier(0.32, 0.1, 0.18, 1)
/** small arrivals: 3.5 % past and back */
export const spring = curve('M0,0 C0.14,0.62 0.25,1.04 0.45,1.035 0.62,1.03 0.78,0.998 1,1')
/** sliding in, braking like on a floor: most of the way early, 3.5 % past, a hair short, settled */
export const glide = curve('M0,0 C0.05,0.6 0.14,1.035 0.3,1.035 0.42,1.035 0.5,0.993 0.62,0.995 0.74,0.997 0.85,1.001 1,1')
/** a quick snap with a little rebound (10 %): stickers, things popping in */
export const pop = curve('M0,0 C0.2,0.9 0.35,1.18 0.55,1.08 0.72,0.99 0.85,1.005 1,1')
/** eases off, is set down and swings 5 % past */
export const landing = curve('M0,0 C0.32,0 0.38,1.1 0.62,1.05 0.76,1.02 0.86,0.995 1,1')
/** something popping into being: 20 % past its size, a touch under, settled */
export const barPop = curve('M0,0 C0.12,0.75 0.2,1.22 0.36,1.2 0.5,1.18 0.56,0.96 0.7,0.975 0.82,0.99 0.9,1.002 1,1')
/** a long turn: gets going from a stand, carries 1.5 % past, settles */
export const wheel = curve('M0,0 C0.28,0.04 0.32,1.03 0.6,1.016 0.78,1.008 0.88,0.999 1,1')

// (exactly 0 and 1 at the ends — floating point would leave a motion a hair off its rest)
const ends = (f: Ease): Ease => p => (p <= 0 ? 0 : p >= 1 ? 1 : f(p))
export const sineIn = ends(p => 1 - Math.cos((p * Math.PI) / 2))
export const sineOut = ends(p => Math.sin((p * Math.PI) / 2))
export const sineInOut = ends(p => (1 - Math.cos(Math.PI * p)) / 2)
/** GSAP's power1 (quad): gravity's rise and fall */
export const quadIn = ends(p => p * p)
export const quadOut = ends(p => 1 - (1 - p) * (1 - p))
/** power2 (cubic) */
export const cubicIn = ends(p => p * p * p)
export const cubicOut = ends(p => 1 - (1 - p) ** 3)
/** power3 / power4: exits that keep speeding up */
export const quartIn = ends(p => p ** 4)
export const quintIn = ends(p => p ** 5)

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** one stretch of a value: [seconds, from, to, ease] */
export type Step = readonly [d: number, from: number, to: number, ease: Ease]

/** a value along steps laid end to end: before them it's the first's `from`, after them the last's `to` */
export function seq(t: number, steps: readonly Step[]): number {
  let at = 0
  for (const [d, a, b, e] of steps) {
    if (t < at + d) return t <= at ? a : a + (b - a) * e((t - at) / d)
    at += d
  }
  return steps[steps.length - 1][2]
}
export const length = (steps: readonly Step[]) => steps.reduce((s, x) => s + x[0], 0)

/**
 * a push that dies away (a bell, a jelly): starts from rest, swings first one way, `f` times a second, losing
 * `decay` per second — and is gone, exactly 0, by `end`
 */
export function ring(t: number, f: number, decay: number, end: number) {
  if (t <= 0 || t >= end) return 0
  // (its first instant eases in, and its last quarter fades out, so it neither jumps off nor stops dead)
  return Math.exp(-decay * t) * Math.sin(2 * Math.PI * f * t) * (1 - Math.exp(-t / 0.03)) * (1 - smoothstep(end * 0.7, end, t))
}
