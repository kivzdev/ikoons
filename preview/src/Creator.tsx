import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { gsap } from 'gsap'
import { FACE } from './art'
import { Says } from './Controls'
import { BURST_BACK, BURST_F, BURST_FRONT, EMBERS, FIGURLY_WORD, IKOONS_STAR, IKOONS_WORD, type Shape } from './product-art'

// "More from the Creator" (Kivz's design of the site, 2026-11-05: under the pages in the left rail): what else Kivz
// makes, a card each — kivz.dev, ikoons, Figurly — the same cards as on kivz.dev, grey and still at rest like there.
// Lit (hovered or focused), a card takes its colours and its drawing comes in and moves: kivz.dev's mascot hops, ikoons'
// pixels burn leftwards like a flame, Figurly's F hops in its burst. Figurly isn't out yet: pressed, its line turns
// into "Coming soon." for a while.

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const Word = ({ shapes }: { shapes: Shape[] }) => shapes.map(s => <path key={s.d} d={s.d} fillRule={s.evenodd && 'evenodd'} />)

/* ── ikoons: a flame of pixels (kivz.dev's card, Products.tsx) ─────────────────────────────────────────────────── */

const CELL = 7.5, COLS = 12, ROWS = 6
const STEP = 1000 / 16
const EASE = 0.045
const glow = (heat: number) => 0.5 * heat ** 1.8
const DRAWN = new Float32Array(COLS * ROWS) // the design's own pixels: what shows at rest
EMBERS.forEach((row, y) => row.forEach((a, x) => { if (x < COLS) DRAWN[x * ROWS + y] = a }))

function Embers({ lit }: { lit: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const fire = useRef<(on: boolean) => void>(null)
  useEffect(() => {
    const cv = canvas.current!, c = cv.getContext('2d')!
    // it starts from the drawing: lit, the bed catches and the pixels flow off it; unlit, it settles back into it
    const heat = new Float32Array(COLS * ROWS), shown = Float32Array.from(DRAWN)
    let on = false, raf = 0, then = 0, due = 0, dpr = 1
    const step = () => {
      for (let x = COLS - 1; x > 0; x--) for (let y = 0; y < ROWS; y++) {
        const r = Math.random(), from = Math.min(ROWS - 1, Math.max(0, y + (r < 0.6 ? 0 : r < 0.8 ? -1 : 1)))
        heat[x * ROWS + y] = Math.max(0, heat[(x - 1) * ROWS + from] - Math.random() * 0.24)
      }
      for (let y = 0; y < ROWS; y++) heat[y] = on ? 1 - Math.random() * 0.1 : 0
    }
    const draw = (alpha: ArrayLike<number>) => {
      c.clearRect(0, 0, cv.width, cv.height)
      const at = (n: number) => Math.round(n * CELL * dpr)
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
        const a = alpha[x * ROWS + y]
        if (a < 0.004) continue
        c.fillStyle = `rgb(234 234 233 / ${a.toFixed(3)})`
        c.fillRect(cv.width - at(x + 1), at(y), at(x + 1) - at(x), at(y + 1) - at(y))
      }
    }
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - (then || now)) / 1000)
      then = now
      due += dt * 1000
      while (due >= STEP) { step(); due -= STEP }
      const k = 1 - Math.exp(-dt / EASE)
      let moving = on
      for (let i = 0; i < heat.length; i++) {
        const to = on ? glow(heat[i]) : DRAWN[i]
        shown[i] += (to - shown[i]) * k
        if (Math.abs(to - shown[i]) > 0.003) moving = true
      }
      draw(shown)
      raf = moving ? requestAnimationFrame(frame) : 0
    }
    fire.current = (light: boolean) => {
      on = light
      dpr = devicePixelRatio || 1
      const w = Math.round(COLS * CELL * dpr), h = Math.round(ROWS * CELL * dpr)
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; draw(shown) }
      if (still()) return draw(DRAWN)
      if (!raf) { then = 0; due = STEP; raf = requestAnimationFrame(frame) }
    }
    fire.current(false)
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => fire.current?.(lit), [lit])
  return <canvas ref={canvas} />
}

/* ── Figurly: the F hopping in its burst (kivz.dev's card) ──────────────────────────────────────────────────────── */

const FOOT = '1362.9 306.8'
const HEART = '1364.1 296.3'
const REST = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }

function Burst({ lit }: { lit: boolean }) {
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const f = svg.current!.querySelector('.burst-f')!
    const back = svg.current!.querySelector('.burst-back')!, front = svg.current!.querySelector('.burst-front')!
    gsap.set(f, { svgOrigin: FOOT })
    gsap.set([back, front], { svgOrigin: HEART })
    gsap.to([f, back, front], { ...REST, duration: lit ? 0.15 : 0.3, ease: 'power3.out', overwrite: true })
    if (!lit || still()) return
    const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.5, delay: 0.2 })
      .to(f, { scaleX: 1.12, scaleY: 0.84, duration: 0.14, ease: 'sine.inOut' })
      .to(f, { y: -7, scaleX: 0.93, scaleY: 1.1, rotation: 9, duration: 0.24, ease: 'power2.out' })
      .to(f, { y: 0, scaleX: 0.96, scaleY: 1.05, rotation: 0, duration: 0.2, ease: 'power2.in' })
      .to(f, { scaleX: 1.16, scaleY: 0.8, duration: 0.06, ease: 'power2.out' })
      .addLabel('pow')
      .to(f, { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
      .to(front, { keyframes: [
        { scale: 1.14, rotation: 5, duration: 0.08, ease: 'power2.out' },
        { scale: 1, rotation: 0, duration: 0.75, ease: 'elastic.out(1, 0.45)' },
      ] }, 'pow-=0.03')
      .to(back, { keyframes: [
        { scale: 1.07, rotation: -2, duration: 0.09, ease: 'power2.out' },
        { scale: 1, rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' },
      ] }, 'pow-=0.02')
    return () => void loop.kill()
  }, [lit])
  return (
    <svg ref={svg} viewBox="1291 273 97 45">
      <path className="burst-back" d={BURST_BACK} fill="#59341a" />
      <path className="burst-front" d={BURST_FRONT} fill="#b85b19" />
      <path className="burst-f" d={BURST_F} fill="#fda900" />
    </svg>
  )
}

/* ── the cards: grey and still at rest (as on kivz.dev); one highlight slides to the card under the pointer or the
   focus and lights it — its mark takes its colour, its line comes up a step, its drawing fades in and moves ───── */

type Card = { lit: boolean; bind: object }

function Kivz({ lit, bind }: Card) {
  return (
    <a className="card card-kivz" href="https://kivz.dev" data-on={lit ? '' : undefined} {...bind}>
      <span className="card-art" aria-hidden />
      <svg className="card-face" viewBox="1248 231 14.2 11" width="14" height="11" aria-hidden>
        <path d={FACE.puff} fill="#fdd900" />
        {FACE.eyes.map(d => <path key={d} d={d} fill="#fdfdfc" />)}
        {FACE.pupils.map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx={0.5} ry={1.05} fill="#141414" />)}
        <path d={FACE.smile} fill="#141414" />
      </svg>
      <span className="card-name">kivz.dev</span>
    </a>
  )
}

function Ikoons({ lit, bind }: Card) {
  return (
    <a className="card card-ikoons" href="/" data-on={lit ? '' : undefined} aria-label="ikoons — Open-source icon library." {...bind}>
      <span className="card-art" aria-hidden><Embers lit={lit} /></span>
      <svg className="card-mark" viewBox="1211 232 60 14" width="60" height="14" fill="currentColor" aria-hidden>
        <path d={IKOONS_STAR} />
        <Word shapes={IKOONS_WORD} />
      </svg>
      <span className="card-sub">Open-source icon library.</span>
    </a>
  )
}

function Figurly({ lit, bind }: Card) {
  const [soon, setSoon] = useState(false)
  const quiet = useRef(0)
  useEffect(() => () => clearTimeout(quiet.current), [])
  const press = () => {
    setSoon(true)
    clearTimeout(quiet.current)
    quiet.current = window.setTimeout(() => setSoon(false), 2200)
  }
  return (
    <button type="button" className="card card-figurly" data-on={lit ? '' : undefined} onClick={press} aria-label="Figurly — Move your boring websites. Coming soon." {...bind}>
      <span className="card-art" aria-hidden><Burst lit={lit} /></span>
      <svg className="card-mark" viewBox="1211 281 50 14" width="50" height="14" fill="currentColor" aria-hidden>
        <Word shapes={FIGURLY_WORD} />
      </svg>
      <Says className="card-sub" text={soon ? 'Coming soon.' : 'Move your boring websites.'} />
    </button>
  )
}

export function Creator() {
  const [lit, setLit] = useState(-1)
  const group = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const shown = useRef(false)
  // the highlight: it glides to the lit card (a touch past and back), fades in under the first, fades out where it is
  useEffect(() => {
    const p = pill.current!
    const card = lit >= 0 ? (group.current!.querySelectorAll('.card')[lit] as HTMLElement) : null
    if (!card) {
      gsap.to(p, { autoAlpha: 0, duration: 0.25, ease: 'sine.out', overwrite: 'auto' })
      shown.current = false
      return
    }
    const to = { x: card.offsetLeft, y: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight }
    if (shown.current && !still()) gsap.to(p, { ...to, duration: 0.5, ease: 'back.out(1.1)', overwrite: 'auto' })
    else gsap.set(p, { ...to, overwrite: 'auto' })
    if (!shown.current) gsap.to(p, { autoAlpha: 1, duration: 0.25, ease: 'sine.out' })
    shown.current = true
  }, [lit])
  const bind = (i: number) => ({
    onPointerEnter: () => setLit(i),
    onFocus: () => setLit(i),
    onBlur: (e: FocusEvent) => { if (!group.current?.contains(e.relatedTarget as Node)) setLit(-1) },
  })
  return (
    <section className="creator" aria-label="More from the Creator">
      <h2 className="label muted">More from the Creator:</h2>
      <div className="cards" ref={group} onPointerLeave={() => setLit(-1)}>
        <span className="pill" ref={pill} aria-hidden />
        <Kivz lit={lit === 0} bind={bind(0)} />
        <Ikoons lit={lit === 1} bind={bind(1)} />
        <Figurly lit={lit === 2} bind={bind(2)} />
      </div>
    </section>
  )
}
