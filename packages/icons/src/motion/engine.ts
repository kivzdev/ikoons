// The clock every icon runs on: one requestAnimationFrame loop, only while something moves. A motion is a pure function
// of time (`frame(t)`), so it can run backwards from anywhere (a change of mind turns it round where it is) and a test
// can step it frame by frame. Nothing here touches the DOM until something plays.

export interface Run {
  /** seconds (Infinity: it goes on until it's told to finish) */
  readonly duration: number
  /** shows the motion `t` seconds in */
  frame(t: number): void
  /** a run that goes on (a spinner) is asked to come to rest: returns when it will be (in its own time, ≥ `t`) */
  finish?(t: number): number
}

export interface Clock {
  now(): number
  request(tick: () => void): void
}

let custom: Clock | null = null
const browser: Clock = { now: () => performance.now(), request: tick => void requestAnimationFrame(() => tick()) }
const clock = (): Clock | null => custom ?? (typeof requestAnimationFrame === 'function' ? browser : null)

// each tick is asked for on one clock; swapping clocks makes the ones still waiting on the old one stale
let generation = 0
const schedule = (c: Clock) => {
  const g = generation
  c.request(() => {
    if (g === generation) tick()
  })
}

/**
 * tests (and anything that wants to drive time itself) swap the clock; null goes back to the browser's. Whatever is
 * moving carries on on the new clock from where it is.
 */
export function setClock(next: Clock | null) {
  custom = next
  generation++
  ticking = false
  const c = clock()
  if (!c) return
  const now = c.now()
  for (const l of live) l.last = now
  if (live.size) {
    ticking = true
    schedule(c)
  }
}

interface Live {
  run: Run
  t: number
  dir: 1 | -1
  last: number
  end: number
  done: () => void
}

const live = new Set<Live>()
let ticking = false

function tick() {
  const c = clock()
  if (!c) {
    ticking = false
    return
  }
  const now = c.now()
  for (const l of [...live]) {
    if (!live.has(l)) continue
    // a frame never moves more than 50 ms on: a slow device (or a tab coming back) slows a motion down rather
    // than skipping any of it
    const dt = Math.min(Math.max(now - l.last, 0), 50) / 1000
    l.last = now
    const to = l.dir > 0 ? l.end : 0
    let t = l.t + dt * l.dir
    const over = l.dir > 0 ? t >= to : t <= to
    if (over) t = to
    l.t = t
    l.run.frame(t)
    if (over) {
      live.delete(l)
      l.done()
    }
  }
  if (live.size) schedule(c)
  else ticking = false
}

/** one thing moving at a time; a new play replaces whatever was moving */
export class Player {
  private l: Live | null = null

  /** plays `run` from `at` seconds in, forward (`dir` 1) or back (-1); `done` once it gets to the end it's going to */
  play(run: Run, done?: () => void, { at = 0, dir = 1 }: { at?: number; dir?: 1 | -1 } = {}) {
    this.stop()
    const c = clock()
    const l: Live = {
      run,
      t: at,
      dir,
      last: c ? c.now() : 0,
      end: run.duration,
      done: () => {
        if (this.l === l) this.l = null
        done?.()
      },
    }
    run.frame(at)
    if (!c) {
      // no clock (a server, a test DOM, an old browser): straight to where it's going
      if (Number.isFinite(run.duration)) run.frame(dir > 0 ? run.duration : 0)
      l.done()
      return
    }
    this.l = l
    live.add(l)
    if (!ticking) {
      ticking = true
      schedule(c)
    }
  }

  /** turns round where it is: `dir` -1 runs it back toward its start, 1 on toward its end; `done` replaces the old */
  turn(dir: 1 | -1, done?: () => void) {
    const l = this.l
    if (!l) return
    l.dir = dir
    if (done) l.done = () => {
      if (this.l === l) this.l = null
      done()
    }
  }

  /** swaps what's playing for another run on the same clock, from the same time (a motion being let go) */
  replace(run: Run) {
    if (this.l) {
      this.l.run = run
      this.l.end = run.duration
    }
  }

  /** a run that goes on: let it come to rest the way it knows how */
  finish() {
    const l = this.l
    if (!l || Number.isFinite(l.end)) return
    l.end = l.run.finish?.(l.t) ?? l.t
  }

  get busy() {
    return this.l !== null
  }
  get time() {
    return this.l?.t ?? 0
  }
  get dir() {
    return this.l?.dir ?? 1
  }

  /** stops where it is (nothing is put back: that's the caller's business) */
  stop() {
    if (this.l) live.delete(this.l)
    this.l = null
  }
}
