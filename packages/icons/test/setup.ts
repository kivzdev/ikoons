import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setClock, type Clock } from '../src/motion/engine.js'

// A test DOM has no media queries and no frames: these stand in for them. `motion.reduce(true)` turns reduced motion
// on; `time.step(s)` moves the icons' clock on by `s` seconds, a frame (1/60 s) at a time.

let reduced = false
export const motion = {
  reduce(on: boolean) {
    reduced = on
  },
}
if (typeof window !== 'undefined') {
  window.matchMedia = (query: string) => ({
    get matches() { return query.includes('reduce') && reduced },
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}

let now = 0
let waiting: (() => void)[] = []
const fake: Clock = { now: () => now, request: tick => void waiting.push(tick) }
/** the clock the tests run on (to put back after a test swaps in one of its own) */
export const testClock = fake
export const time = {
  /** moves on `seconds`, running a frame every 1/60 s */
  step(seconds: number) {
    const frames = Math.round(seconds * 60)
    for (let i = 0; i < frames; i++) time.frame(1000 / 60)
  },
  /** one frame, `ms` after the last (a long one: a hidden tab, a slow device) */
  frame(ms: number) {
    now += ms
    const ticks = waiting
    waiting = []
    for (const t of ticks) t()
  },
}
setClock(fake)

afterEach(() => {
  cleanup()
  reduced = false
  time.step(5) // (whatever was still moving finishes before the next test)
})
