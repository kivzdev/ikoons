// The drawings an icon shows, and what moves them. At rest there is one; while it changes (a weight, another icon in a
// <Swap>) there are two, the one leaving and the one coming. The rules (Kivz's): a change that's under way is never cut
// short or snapped to its end — what's asked for meanwhile waits, and once it's done the icon goes straight to the last
// thing asked for; going back to the drawing it's leaving turns the change round where it is.

import { Ctx } from '../motion/ctx.js'
import { Player, type Run } from '../motion/engine.js'
import { breathe, letGo } from '../motion/recipes.js'
import { fade, fill, swap, unfill, type Transition } from '../motion/transitions.js'
import type { IconData, Weight } from './types.js'

/** what is drawn: an icon in a weight */
export interface Look {
  readonly data: IconData
  readonly weight: Weight
}
export const keyOf = (l: Look) => `${l.data.name}:${l.weight}`

interface Change {
  from: Look
  to: Look
  /** where it's heading now (a change of mind turns it round) */
  toward: 'to' | 'from'
  /** it plays the other icon's transition backwards */
  reversed: boolean
  started: boolean
  ctx?: [from: Ctx, to: Ctx]
}

const dirOf = (c: Change): 1 | -1 => ((c.toward === 'to') !== c.reversed ? 1 : -1)

/** how one look becomes another */
function choose(a: Look, b: Look, reduced: boolean): { t: Transition; reversed: boolean } {
  if (reduced) return { t: fade(), reversed: false }
  if (a.data === b.data) return { t: b.weight === 'filled' ? fill(b.data.motion) : unfill(), reversed: false }
  const there = a.data.to?.[b.data.name]
  if (there) return { t: there, reversed: false }
  const back = b.data.to?.[a.data.name]
  if (back) return { t: back, reversed: true }
  return { t: swap(), reversed: false }
}

// a motion played on and on (`animate="loop"`) that isn't a loop of its own rests this long between goes
const BETWEEN = 0.6

export class Stack {
  rest: Look
  svg: SVGSVGElement | null = null
  /** asks React to draw the layers again */
  onChange: () => void = () => {}
  reduced: () => boolean = () => false

  private change: Change | null = null
  private queued: Look | null = null
  private els = new Map<string, SVGGElement>()
  private mover = new Player()
  private shot = new Player()
  private shotRun: Run | null = null
  private shotCtx: Ctx | null = null
  private letting = false
  private looping = false
  private looper = new Player()
  private loopCtx: Ctx | null = null

  constructor(look: Look) {
    this.rest = look
  }

  /** the looks to draw, bottom to top */
  layers(): Look[] {
    return this.change ? [this.change.from, this.change.to] : [this.rest]
  }

  ref(key: string, el: SVGGElement | null) {
    if (el) this.els.set(key, el)
    else this.els.delete(key)
  }

  /** the props ask for this look */
  request(look: Look) {
    const k = keyOf(look)
    const c = this.change
    if (c) {
      if (!c.started) {
        // nothing has moved yet: just change where it's going
        if (k === keyOf(c.from)) this.change = null
        else c.to = look
        this.onChange()
        return
      }
      if (k === keyOf(c.from) || k === keyOf(c.to)) {
        const toward = k === keyOf(c.to) ? 'to' : 'from'
        this.queued = null
        if (c.toward !== toward) {
          c.toward = toward
          this.mover.turn(dirOf(c))
        }
        return
      }
      this.queued = look
      return
    }
    if (k === keyOf(this.rest)) {
      this.queued = null
      return
    }
    if (this.shot.busy) {
      // the hover flourish eases back to the drawing first (a moment), then the change starts from rest
      this.queued = look
      this.letGo()
      return
    }
    this.begin(look)
  }

  private begin(look: Look) {
    this.change = { from: this.rest, to: look, toward: 'to', reversed: false, started: false }
    this.onChange()
  }

  /** after React has drawn: starts a change whose layers are now there */
  mounted() {
    const c = this.change
    if (!c || c.started || !this.svg) return
    const a = this.els.get(keyOf(c.from))
    const b = this.els.get(keyOf(c.to))
    if (!a || !b) return
    a.removeAttribute('visibility')
    b.removeAttribute('visibility')
    c.started = true
    const ca = new Ctx(this.svg, a)
    const cb = new Ctx(this.svg, b)
    const { t, reversed } = choose(c.from, c.to, this.reduced())
    c.reversed = reversed
    c.ctx = [ca, cb]
    const run = t(reversed ? { from: cb, to: ca } : { from: ca, to: cb })
    const dir = dirOf(c)
    this.mover.play(run, () => this.finish(), { at: dir > 0 ? 0 : run.duration, dir })
  }

  private finish() {
    const c = this.change
    if (!c?.ctx) return
    const landed = c.toward === 'to' ? c.to : c.from
    const [ca, cb] = c.ctx
    const [keep, drop] = landed === c.to ? [cb, ca] : [ca, cb]
    keep.restore()
    // the other drawing is put back to rest too (React may reuse its layer), but out of sight until React drops it
    drop.restore()
    drop.layer.setAttribute('visibility', 'hidden')
    if (this.shotCtx?.layer === drop.layer) this.stopShot()
    if (this.loopCtx?.layer === drop.layer) this.stopLoop()
    this.rest = landed
    this.change = null
    this.onChange()
    const q = this.queued
    this.queued = null
    if (q && keyOf(q) !== keyOf(landed)) this.begin(q)
    else this.startLoop()
  }

  /** plays the icon's motion once (hover, press, `cue`): not while it's changing or already moving */
  poke() {
    if (this.change || this.shot.busy || this.looping || this.reduced() || !this.svg) return
    const el = this.els.get(keyOf(this.rest))
    const m = this.rest.data.motion
    if (!el || !m) return
    const c = new Ctx(this.svg, el)
    const run = m(c)
    if (!Number.isFinite(run.duration)) return // (a loop only runs as a loop)
    this.shotCtx = c
    this.shotRun = run
    this.letting = false
    this.shot.play(run, () => this.shotDone(c))
  }

  private shotDone(c: Ctx) {
    c.restore()
    if (this.shotCtx === c) {
      this.shotCtx = null
      this.shotRun = null
    }
    const q = this.queued
    if (q && !this.change) {
      this.queued = null
      if (keyOf(q) !== keyOf(this.rest)) this.begin(q)
    }
  }

  private letGo() {
    if (this.letting || !this.shotRun || !this.shotCtx) return
    this.letting = true
    this.shot.replace(letGo(this.shotRun, this.shotCtx, this.shot.time))
  }

  private stopShot() {
    this.shot.stop()
    this.shotCtx?.restore()
    this.shotCtx = null
    this.shotRun = null
  }

  /** `animate="loop"`: the motion goes on and on; turned off, it comes to rest the way it knows (a spinner: at a turn) */
  loop(on: boolean) {
    this.looping = on
    if (on) this.startLoop()
    else this.looper.finish()
  }

  private startLoop() {
    if (!this.looping || this.looper.busy || this.change || !this.svg) return
    const el = this.els.get(keyOf(this.rest))
    const m = this.rest.data.motion
    if (!el || !m) return
    const c = new Ctx(this.svg, el)
    const run = this.reduced() ? breathe()(c) : m(c)
    this.loopCtx = c
    this.looper.play(run, () => {
      c.restore()
      if (this.loopCtx === c) this.loopCtx = null
      if (!this.looping) return
      // a motion that isn't a loop of its own plays again after a rest
      if (Number.isFinite(run.duration)) this.looper.play({ duration: BETWEEN, frame() {} }, () => this.startLoop())
      else this.startLoop()
    })
  }

  private stopLoop() {
    this.looper.stop()
    this.loopCtx?.restore()
    this.loopCtx = null
  }

  /** the icon is going away: everything stops, and the drawing is left as it is */
  dispose() {
    this.mover.stop()
    this.stopShot()
    this.stopLoop()
    const c = this.change
    if (c?.ctx) {
      c.ctx[0].restore()
      c.ctx[1].restore()
    }
    if (c) {
      this.rest = c.toward === 'to' ? c.to : c.from
      this.change = null
      this.onChange()
    }
  }
}
