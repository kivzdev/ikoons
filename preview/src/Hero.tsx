import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

// The banner (Kivz's design, 2026-11-05; Frame 688 for its light): the set's icons on a slight tilt, dim, picked at
// random on every visit. Its rows drift very slowly and never end: one to the left, the next to the right, and so on,
// each a loop with no seam (a row is its icons twice over, moving by one length of them). (Columns drifting up and down
// were tried first — Kivz: the verticals looked bad.) Now and then a handful of icons light up together, scattered over
// it — about one in sixteen of those in view, as in the design — and go back while the next handful comes (Kivz: "not
// one at a time"). The line over them sits on a soft dark oval so the icons fade out around it.
//
// What it costs: nothing per frame on the page's own thread. A row is a box that's moved whole (its icons are drawn
// once, then only slid along, the way a picture is), and an icon lighting up is a copy of it laid over it whose
// opacity rises and falls — moving and fading boxes are the graphics card's job. (Its first build moved the rows inside
// one SVG, which the page had to paint again on every frame: a third of its time, scrolling stuttered.) Off screen, it
// stops.

const TILT = 5.44 // the design's degrees
const PITCH = 38.63 // from one icon to the next, both ways
const SIZE = 27.39 // an icon's box (24 units)
const DIM = 0.06, LIT = 0.24 // at rest, and at its brightest (the design's)
const OVER = (LIT - DIM) / (1 - DIM) // a lit icon's copy: over the dim one, together they come to LIT
const SPEED = 2 // px a second: the rows' drift (Kivz: slower, and slower again)
const SHARE = 0.06 // of the icons in view lit at once (the design: 9 of 146)
const EVERY = 3400 // ms from one handful starting to light up to the next (the last is going as it comes)
const GLOW = 5600 // ms one takes to light up, stay a moment and go back
const APART = 2.2 * PITCH // two lit at once are never closer than this

const shuffled = <T,>(a: readonly T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const SVG = 'http://www.w3.org/2000/svg'
// (a sine in-out for each stretch of the glow: up, stay, down)
const SINE = 'cubic-bezier(0.37, 0, 0.63, 1)'

interface Row { left: number; y: number; icons: number[]; right: boolean }

export function Hero() {
  const box = useRef<HTMLElement>(null)
  const tilt = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [away, setAway] = useState(false)
  // (the drawings are their own chunk: the page doesn't wait for them, they fade in when they're here)
  const [pool, setPool] = useState<string[] | null>(null)
  useEffect(() => void import('virtual:ikoons-hero').then(m => setPool(m.default)), [])

  useEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setSize(s => (s && Math.abs(s.w - el.clientWidth) < 40 && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight })))
    ro.observe(el)
    // scrolled past (or the page out of sight), it stands still
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting))
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect() }
  }, [])

  // the rows that cover the banner once it's tilted, each long enough to fill it and then once more (its loop)
  const rows = useMemo<Row[]>(() => {
    if (!size || !pool) return []
    const a = (TILT * Math.PI) / 180
    const across = size.h * Math.cos(a) + size.w * Math.sin(a) + 2 * PITCH
    const along = size.w * Math.cos(a) + size.h * Math.sin(a) + 2 * PITCH
    const count = Math.ceil(across / PITCH)
    const each = Math.ceil(along / PITCH)
    const picks = shuffled(pool.map((_, i) => i))
    let k = 0
    return Array.from({ length: count }, (_, j) => ({
      left: size.w / 2 - along / 2,
      y: size.h / 2 + (j - (count - 1) / 2) * PITCH - SIZE / 2,
      icons: Array.from({ length: each }, () => picks[k++ % picks.length]),
      right: j % 2 === 1,
    }))
  }, [size, pool])
  const period = rows[0] ? rows[0].icons.length * PITCH : 0
  const dur = period / SPEED

  // every few seconds a handful lights up together: icons in view (not under the line), scattered, each a beat apart
  useEffect(() => {
    const t = tilt.current
    if (!t || !rows.length || !size || away || still()) return
    const a = (TILT * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a)
    const cx = size.w / 2, cy = size.h / 2
    const title = box.current!.querySelector('.hero-title')!.getBoundingClientRect()
    const bb = box.current!.getBoundingClientRect()
    const tx = title.left + title.width / 2 - bb.left, ty = title.top + title.height / 2 - bb.top
    const rx = title.width / 2, ry = title.height / 2
    const lit: { x: number; y: number; until: number }[] = []
    const burst = () => {
      if (document.hidden) return
      const now = performance.now()
      for (let i = lit.length - 1; i >= 0; i--) if (lit[i].until < now) lit.splice(i, 1)
      // where every icon is right now: its row's place in its loop, then the tilt
      const seen: { row: HTMLElement; j: number; n: number; x: number; y: number }[] = []
      let inView = 0
      rows.forEach((r, i) => {
        const row = t.children[i] as HTMLElement | undefined
        const run = row?.getAnimations()[0]
        const p = run ? ((Number(run.currentTime) || 0) / (dur * 1000)) % 1 : 0
        const shift = r.right ? -period + p * period : -p * period
        r.icons.concat(r.icons).forEach((n, j) => {
          const lx = r.left + j * PITCH + shift + SIZE / 2 - cx
          const ly = r.y + SIZE / 2 - cy
          const x = cx + lx * cos - ly * sin
          const y = cy + lx * sin + ly * cos
          const edge = SIZE / 2 + 4
          if (x < edge || x > size.w - edge || y < edge || y > size.h - edge) return
          inView++
          if (((x - tx) / rx) ** 2 + ((y - ty) / ry) ** 2 < 1) return // (under the line's oval: it wouldn't show)
          seen.push({ row: row!, j, n, x, y })
        })
      })
      const want = Math.max(3, Math.round(inView * SHARE))
      const picked: typeof seen = []
      for (const s of shuffled(seen)) {
        if (picked.length >= want) break
        const near = (o: { x: number; y: number }) => Math.hypot(o.x - s.x, o.y - s.y) < APART
        if (picked.some(near) || lit.some(near)) continue
        picked.push(s)
      }
      picked.forEach(s => {
        const delay = Math.random() * 450
        const el = document.createElementNS(SVG, 'svg')
        el.setAttribute('class', 'hero-lit')
        el.setAttribute('viewBox', '0 0 24 24')
        el.setAttribute('width', String(SIZE))
        el.setAttribute('height', String(SIZE))
        el.setAttribute('fill', 'none')
        el.style.left = `${(s.j * PITCH).toFixed(2)}px`
        const use = document.createElementNS(SVG, 'use')
        use.setAttribute('href', `#hx${s.n}`)
        el.appendChild(use)
        s.row.appendChild(el)
        el.animate(
          [{ opacity: 0, easing: SINE }, { opacity: OVER, offset: 0.3, easing: SINE }, { opacity: OVER, offset: 0.48, easing: SINE }, { opacity: 0 }],
          { duration: GLOW, delay, fill: 'backwards' },
        ).finished.then(() => el.remove(), () => el.remove())
        lit.push({ x: s.x, y: s.y, until: now + delay + GLOW })
      })
    }
    let timer = 0
    const next = () => { timer = window.setTimeout(() => { burst(); next() }, EVERY * (0.85 + Math.random() * 0.3)) }
    timer = window.setTimeout(() => { burst(); next() }, 900)
    return () => clearTimeout(timer)
  }, [rows, size, period, dur, away])

  return (
    <section className="hero" ref={box} data-away={away ? '' : undefined}>
      {size && pool && (
        <div className="hero-icons" data-in={rows.length ? '' : undefined} aria-hidden>
          {/* each drawing once, used wherever it shows; fill="none": an outline drawing's paths say only their stroke */}
          <svg className="hero-defs" width="0" height="0">
            <defs>
              {pool.map((svg, i) => <symbol key={i} id={`hx${i}`} viewBox="0 0 24 24" fill="none" dangerouslySetInnerHTML={{ __html: svg }} />)}
            </defs>
          </svg>
          <div className="hero-tilt" ref={tilt} style={{ transform: `rotate(${TILT}deg)` }}>
            {rows.map((r, i) => (
              // (the row moves as one: its icons, then the same icons again, by one length of them)
              <div
                key={i}
                className={r.right ? 'hero-row hero-row-right' : 'hero-row'}
                style={{ left: `${r.left.toFixed(2)}px`, top: `${r.y.toFixed(2)}px`, width: `${(2 * period).toFixed(2)}px`, '--period': `${period.toFixed(2)}px`, '--dur': `${dur.toFixed(1)}s` } as CSSProperties}
              >
                <svg className="hero-dim" width={(2 * period).toFixed(2)} height={SIZE} style={{ opacity: DIM }}>
                  {r.icons.concat(r.icons).map((n, j) => <use key={j} href={`#hx${n}`} x={(j * PITCH).toFixed(2)} width={SIZE} height={SIZE} />)}
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}
      <h1 className="hero-title">Thousands of icons, all in one place, free to use.</h1>
    </section>
  )
}
