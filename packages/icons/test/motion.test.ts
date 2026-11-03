import { describe, expect, it } from 'vitest'
import {
  barPop, bezier, curve, cubicOut, glide, landing, pop, quadIn, ring, seq, sineIn, sineInOut, sineOut, slide, soft,
  spring, swift, wheel, type Ease,
} from '../src/motion/ease.js'
import { Player, setClock, type Run } from '../src/motion/engine.js'
import { testClock, time } from './setup.js'

const samples = (e: Ease, n = 2000) => Array.from({ length: n + 1 }, (_, i) => e(i / n))
const peak = (e: Ease) => Math.max(...samples(e))

describe('the curves', () => {
  const all = { soft, swift, slide, spring, glide, pop, landing, barPop, wheel, sineIn, sineOut, sineInOut, quadIn, cubicOut }
  it.each(Object.entries(all))('%s starts at 0 and ends at 1', (_, e) => {
    expect(e(0)).toBe(0)
    expect(e(1)).toBe(1)
  })

  it('arrive past their place by what the site’s do, once, and come back', () => {
    expect(peak(spring)).toBeCloseTo(1.035, 2)
    expect(peak(glide)).toBeCloseTo(1.035, 2)
    expect(peak(pop)).toBeCloseTo(1.1, 2)
    expect(peak(landing)).toBeCloseTo(1.05, 2)
    expect(peak(barPop)).toBeCloseTo(1.2, 2)
    expect(peak(soft)).toBeLessThanOrEqual(1)
  })

  it('match CSS’s cubic-bezier (the same curve, solved the same way)', () => {
    // cubic-bezier(.22, 1, .36, 1) — the site's `soft` — at 25 / 50 / 75 %, read off the curve sampled densely
    const e = bezier(0.22, 1, 0.36, 1)
    expect(e(0.25)).toBeCloseTo(0.76486, 4)
    expect(e(0.5)).toBeCloseTo(0.96138, 4)
    expect(e(0.75)).toBeCloseTo(0.99689, 4)
    // and the in-out is symmetric
    expect(swift(0.3) + swift(0.7)).toBeCloseTo(1, 6)
  })

  it('read the CustomEase path form, segment by segment', () => {
    const two = curve('M0,0 C0.25,0.5 0.25,0.5 0.5,0.5 0.75,0.5 0.75,1 1,1')
    expect(two(0.5)).toBeCloseTo(0.5, 3)
    expect(two(0.25)).toBeGreaterThan(0.25)
  })

  it('are smooth: no step jumps more than a smooth curve can between neighbours', () => {
    for (const e of [spring, glide, pop, landing, wheel]) {
      const s = samples(e)
      const jump = Math.max(...s.slice(1).map((v, i) => Math.abs(v - s[i])))
      expect(jump).toBeLessThan(0.01)
    }
  })
})

describe('steps', () => {
  const k = [[0.1, 0, -0.2, sineInOut], [0.2, -0.2, 1, cubicOut], [0.5, 1, 0, spring]] as const
  it('hold their first value before and their last after', () => {
    expect(seq(-1, k)).toBe(0)
    expect(seq(9, k)).toBe(0)
  })
  it('go a little the other way first (the wind-up), then out, then back', () => {
    expect(seq(0.1, k)).toBeCloseTo(-0.2, 5)
    expect(seq(0.3, k)).toBeCloseTo(1, 5)
    expect(Math.min(...Array.from({ length: 100 }, (_, i) => seq(0.3 + i * 0.005, k)))).toBeLessThan(0)
  })
})

describe('a swing that dies away', () => {
  it('starts and ends at exactly 0, first going the way of its sign', () => {
    expect(ring(0, 2, 3, 1.5)).toBe(0)
    expect(ring(1.5, 2, 3, 1.5)).toBe(0)
    expect(ring(0.1, 2, 3, 1.5)).toBeGreaterThan(0)
  })
  it('loses energy with every swing', () => {
    const peaks = [0.125, 0.625, 1.125].map(t => Math.abs(ring(t, 2, 3, 2)))
    expect(peaks[0]).toBeGreaterThan(peaks[1])
    expect(peaks[1]).toBeGreaterThan(peaks[2])
  })
})

describe('the clock', () => {
  const run = (duration: number, seen: number[]): Run => ({ duration, frame: t => void seen.push(t) })

  it('plays a run from its first frame to its last', () => {
    const seen: number[] = []
    let done = false
    new Player().play(run(0.5, seen), () => (done = true))
    expect(seen).toEqual([0])
    time.step(0.25)
    expect(done).toBe(false)
    time.step(0.5)
    expect(done).toBe(true)
    expect(seen.at(-1)).toBe(0.5)
    expect(seen.every((t, i) => i === 0 || t >= seen[i - 1])).toBe(true)
  })

  it('turns round where it is, and runs back to the start', () => {
    const seen: number[] = []
    const p = new Player()
    let back = false
    p.play(run(1, seen))
    time.step(0.4)
    const at = seen.at(-1)!
    p.turn(-1, () => (back = true))
    time.step(0.2)
    expect(seen.at(-1)!).toBeLessThan(at)
    time.step(0.4)
    expect(back).toBe(true)
    expect(seen.at(-1)).toBe(0)
  })

  it('never moves on more than 50 ms in a frame (a long frame slows it rather than skipping it)', () => {
    const seen: number[] = []
    new Player().play(run(2, seen))
    time.frame(16)
    time.frame(800)
    expect(seen.at(-1)! - seen.at(-2)!).toBeCloseTo(0.05, 5)
  })

  it('carries on, from where it is, on a clock swapped in while it moves', () => {
    const seen: number[] = []
    let stuck = true
    const late: (() => void)[] = []
    // a clock whose frames never come (a page in the background) …
    setClock({ now: () => 0, request: tick => void late.push(tick) })
    new Player().play(run(1, seen), () => (stuck = false))
    // … swapped for the test's own: the motion goes on there, and the old clock's frame, when it comes, does nothing
    setClock(testClock)
    time.step(0.5)
    const at = seen.at(-1)!
    late.forEach(t => t())
    expect(seen.at(-1)).toBe(at)
    expect(at).toBeCloseTo(0.5, 1)
    time.step(0.6)
    expect(stuck).toBe(false)
  })

  it('lets a run that goes on come to rest the way it says', () => {
    const seen: number[] = []
    const p = new Player()
    let done = false
    p.play({ duration: Infinity, frame: t => void seen.push(t), finish: t => t + 0.2 }, () => (done = true))
    time.step(1)
    expect(done).toBe(false)
    p.finish()
    time.step(0.3)
    expect(done).toBe(true)
  })
})
