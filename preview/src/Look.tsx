import { useEffect, useRef, type CSSProperties } from 'react'
import { Range, Stack, Switch, Toggle } from './Controls'
import { COUNT, GROUPS } from './icons'
import type { Look as LookT } from './settings'

// The right rail (Kivz's design, 2026-11-05): how the icons look — style, lines, size, animation on or off — and
// under it the categories: press one and the middle shows only its icons (All icons: every one of them).

export function LookControls({ look, set }: { look: LookT; set: <K extends keyof LookT>(k: K) => (v: LookT[K]) => void }) {
  return (
    <div className="controls">
      <Switch label="Style" value={look.weight} onChange={set('weight')} options={[{ value: 'outline', label: 'Outline' }, { value: 'filled', label: 'Filled' }] as const} />
      <div className="controls-pair">
        <Range label="Lines" value={look.stroke} min={1} max={3} step={0.25} steps={LINES} onChange={set('stroke')} format={v => String(v)} />
        <Range label="Size" value={look.size} min={16} max={96} step={1} steps={SIZES} onChange={set('size')} format={v => `${v} px`} />
      </div>
      <Toggle label="Animation" on={look.motion !== 'off'} onChange={on => set('motion')(on ? 'hover' : 'off')} />
    </div>
  )
}

// the sizes an icon comes in, and its lines' widths: the steps the sliders stop at
const SIZES = [16, 20, 24, 28, 32, 40, 48, 64, 96] as const
const LINES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3] as const

const ITEMS = [{ id: null as string | null, title: 'All icons', n: COUNT }, ...GROUPS.map(g => ({ id: g.id as string | null, title: g.title, n: g.names.length }))]

/** the categories: eight rows of them, the rest scrolling by in their box (Kivz); its edges fade where there's more */
export function Categories({ active, choose }: { active: string | null; choose(id: string | null): void }) {
  const at = ITEMS.findIndex(it => it.id === active)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = list.current!
    const read = () => {
      el.toggleAttribute('data-up', el.scrollTop > 1)
      el.toggleAttribute('data-down', el.scrollTop + el.clientHeight < el.scrollHeight - 1)
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', read); ro.disconnect() }
  }, [])
  return (
    <section className="cats" aria-label="Categories">
      <h2 className="label muted">Categories</h2>
      {/* (data-lenis-prevent: it scrolls itself, on the browser's own scrolling, and stops at its ends) */}
      <div className="cats-list" ref={list} data-lenis-prevent="" style={{ '--n': ITEMS.length } as CSSProperties}>
        <Stack label="Categories" active={at}>
          {bind => ITEMS.map((it, i) => (
            <button key={it.id ?? 'all'} type="button" className="btn cat" aria-pressed={i === at} onClick={() => choose(it.id)} {...bind(i)}>
              <span className="cat-title">{it.title}</span>
              <span className="cat-n">{it.n.toLocaleString('en')}</span>
            </button>
          ))}
        </Stack>
      </div>
    </section>
  )
}
