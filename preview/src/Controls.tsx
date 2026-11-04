import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

// The rail's controls, in kivz.dev's parts: every control is one 30 px box, a group of them shares one highlight that
// glides to whatever is hovered or focused and rests under the chosen one (the words take their colour from it, not
// from the pointer); a label sits over each, grey and small.

/** a label over a control */
export function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="control">
      <span className="label muted">{label}</span>
      {children}
    </div>
  )
}

/** which box the highlight is under: the hovered or focused one, else the chosen one (-1: none, it fades) */
function useHot(chosen: number) {
  const [hot, setHot] = useState<number | null>(null)
  const at = hot ?? chosen
  const bind = (i: number) => ({ onPointerEnter: () => setHot(i), onFocus: () => setHot(i), onBlur: () => setHot(null) })
  return { at, bind, leave: () => setHot(null) }
}

/** a row of equal boxes, one of them chosen */
export function Switch<T>({ label, options, value, onChange }: {
  label: string
  options: readonly { value: T; label: ReactNode; title?: string }[]
  value: T
  onChange(v: T): void
}) {
  const chosen = options.findIndex(o => Object.is(o.value, value))
  const { at, bind, leave } = useHot(chosen)
  return (
    <Control label={label}>
      <div className="pills-x" role="group" aria-label={label} onPointerLeave={leave}>
        <span className="pill" aria-hidden style={{ width: `${100 / options.length}%`, transform: `translateX(${at * 100}%)` }} />
        {options.map((o, i) => (
          <button
            key={String(o.value)}
            type="button"
            className="btn"
            title={o.title}
            data-on={i === at ? '' : undefined}
            aria-pressed={i === chosen}
            onClick={() => onChange(o.value)}
            {...bind(i)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Control>
  )
}

/** a column of full-width boxes (links or buttons) under one highlight; `active` rests it (-1: only while hovered) */
export function Stack({ label, active = -1, children }: { label: string; active?: number; children: (bind: (i: number) => object, at: number) => ReactNode }) {
  const { at, bind, leave } = useHot(active)
  return (
    <nav className="pills-y" aria-label={label} onPointerLeave={leave}>
      <span className="pill" aria-hidden style={{ '--at': Math.max(at, 0), opacity: at < 0 ? 0 : 1 } as CSSProperties} />
      {children(i => ({ ...bind(i), 'data-on': i === at ? '' : undefined }), at)}
    </nav>
  )
}

/**
 * a number in a box: the share of the box that's lit is how far along it is, a thin thumb at its edge. Held, it follows
 * the pointer exactly; let go, it settles on its step on the site's spring. `steps`: only those values, spaced evenly
 * along the box (a size: 16, 20, 24…), each marked by a tick; otherwise any value `step` apart. The keys move it a step.
 */
export function Range({ label, value, min, max, step, steps, onChange, format = String }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  steps?: readonly number[]
  onChange(v: number): void
  format?(v: number): string
}) {
  const last = steps ? steps.length - 1 : 0
  const toPos = (v: number) => (steps ? Math.max(0, steps.indexOf(v)) / last : (v - min) / (max - min))
  const fromPos = (p: number) => (steps ? steps[Math.round(p * last)] : +(Math.round((min + p * (max - min)) / step) * step).toFixed(4))
  const [held, setHeld] = useState<number | null>(null) // where the pointer is, 0–1, while it's held
  const frame = useRef(0)
  const next = useRef(value)
  const send = (v: number) => {
    next.current = v
    frame.current ||= requestAnimationFrame(() => { frame.current = 0; if (next.current !== value) onChange(next.current) })
  }
  const p = held ?? toPos(value)
  const key = (e: KeyboardEvent) => {
    const by = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!by) return
    e.preventDefault()
    if (steps) onChange(steps[Math.min(last, Math.max(0, steps.indexOf(value) + by))])
    else onChange(Math.min(max, Math.max(min, +(value + by * step).toFixed(4))))
  }
  return (
    <Control label={label}>
      <label className="range" data-held={held !== null ? '' : undefined} style={{ '--p': p } as CSSProperties}>
        {/* (the track: the box less a little each side, so the thumb and the ticks keep off the corners; the fill's edge
            is always where the thumb is) */}
        <span className="range-track" aria-hidden>
          <span className="range-fill" />
          {steps && <span className="range-ticks">{steps.map((s, i) => <i key={s} style={{ '--t': i / last } as CSSProperties} />)}</span>}
          <span className="range-thumb" />
        </span>
        <span className="range-value">{format(held !== null ? fromPos(held) : value)}</span>
        <input
          type="range" min={0} max={1000} step="any" value={p * 1000} aria-label={label}
          aria-valuetext={format(value)}
          onChange={e => { const at = +e.target.value / 1000; setHeld(at); send(fromPos(at)) }}
          onPointerUp={() => setHeld(null)} onBlur={() => setHeld(null)} onKeyDown={key}
        />
      </label>
    </Control>
  )
}

/** a row that says what it turns on, with its switch at the far end (Animation: the icons move when hovered, or not) */
export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange(v: boolean): void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="toggle" onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className="toggle-track" aria-hidden><span className="toggle-knob" /></span>
    </button>
  )
}

export const COLOURS = [
  { value: 'current', name: 'Text colour' },
  { value: '#000000', name: 'Black' },
  { value: '#007afd', name: 'Blue' },
  { value: '#55ff5e', name: 'Green' },
  { value: '#fdd900', name: 'Yellow' },
  { value: '#ff5fa8', name: 'Pink' },
  { value: '#ff3542', name: 'Red' },
] as const

/** the colours, four to a row, and the last box opens the system's colour picker */
export function Colours({ value, onChange }: { value: string; onChange(v: string): void }) {
  const own = !COLOURS.some(c => c.value === value)
  const chosen = own ? COLOURS.length : COLOURS.findIndex(c => c.value === value)
  const { at, bind, leave } = useHot(chosen)
  const picker = useRef<HTMLInputElement>(null)
  const cols = 4
  return (
    <Control label="Colour">
      <div className="swatches" role="group" aria-label="Colour" onPointerLeave={leave}>
        <span className="pill" aria-hidden style={{ transform: `translate(${(at % cols) * 100}%, ${Math.floor(at / cols) * 100}%)` }} />
        {COLOURS.map((c, i) => (
          <button key={c.value} type="button" className="btn" title={c.name} aria-label={c.name} aria-pressed={i === chosen} data-on={i === at ? '' : undefined} onClick={() => onChange(c.value)} {...bind(i)}>
            <span className="dot" style={{ background: c.value === 'current' ? 'var(--fg)' : c.value }} />
          </button>
        ))}
        <button type="button" className="btn" title="Any colour" aria-label="Any colour" aria-pressed={own} data-on={at === COLOURS.length ? '' : undefined} onClick={() => picker.current?.click()} {...bind(COLOURS.length)}>
          <span className="dot dot-own" style={own ? { background: value } : undefined} />
          <input ref={picker} type="color" tabIndex={-1} aria-hidden value={own ? value : '#007afd'} onChange={e => onChange(e.target.value)} />
        </button>
      </div>
    </Control>
  )
}

const OUT: Keyframe[] = [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }]
const IN: Keyframe[] = [{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)' }]
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * something that changes by blurring out where it stands and blurring back in as the new one — nothing slides (words;
 * an icon in its other style). `k` says when it's another one; until the old one has gone, it's the old one that shows.
 * A change under way always finishes; whatever was asked for meanwhile is gone to next, the last of it only
 */
export function Swaps({ k, className, children }: { k: string; className?: string; children: ReactNode }) {
  const el = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(k)
  const kept = useRef(children)
  if (shown === k) kept.current = children
  const now = useRef(k)
  const want = useRef(k)
  const busy = useRef(false)
  want.current = k
  useEffect(() => {
    if (busy.current || want.current === now.current) return
    busy.current = true
    void (async () => {
      while (want.current !== now.current) {
        if (!still()) await el.current?.animate(OUT, { duration: 200, easing: 'cubic-bezier(.12,0,.39,0)', fill: 'forwards' }).finished
        now.current = want.current
        setShown(now.current)
        await new Promise(requestAnimationFrame)
        if (!still()) await el.current?.animate(IN, { duration: 450, easing: 'cubic-bezier(.61,1,.88,1)', fill: 'forwards' }).finished
      }
      busy.current = false
    })()
  }, [k])
  return <span ref={el} className={className}>{kept.current}</span>
}

/** words that change by blurring out where they stand and blurring back in as the new ones */
export const Says = ({ text, className }: { text: string; className?: string }) => <Swaps k={text} className={className}>{text}</Swaps>
