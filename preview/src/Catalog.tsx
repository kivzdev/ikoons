import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { MagnifyingGlass } from 'ikoons/icons/magnifying-glass'
import { Play } from 'ikoons/icons/play'
import { X } from 'ikoons/icons/x'
import { playIcon } from '@lib/core/create'
import type { Icon, Weight } from '@lib/core/types'
import { animateOf, type Look } from './settings'
import { Says } from './Controls'
import { Hero } from './Hero'
import { COUNT, GROUPS, useGroup } from './icons'

// The icons page (Kivz's design, 2026-11-05): the banner, the search with "Play all" beside it, and the grid — every
// icon, or only the category picked in the right rail. Five thousand of them, so only the blocks near the screen (ninety
// icons each) are drawn at all: one comes in as you scroll to it — its boxes breathing as skeletons while its group's
// chunk arrives, then its icons one after another in reading order — and goes back to an empty space of its own height
// once it's far behind (Kivz: "the site eats far too much memory"). The search knows every name from the start, and
// Tabler's tags once you type.

type Tags = Record<string, string>
let tagsP: Promise<Tags> | null = null
const loadTags = () => (tagsP ??= import('../../icons/tags.json').then(m => m.default as Tags))

const PER = 90
// what the search offers to look for, one after another in its placeholder ("Search 5,214 icons for weather")
const HINTS = ['arrows', 'weather', 'devices', 'brands', 'money', 'files', 'music', 'maps', 'charts', 'food', 'sports', 'chat', 'faces', 'health', 'loaders', 'shapes']
const matches = (name: string, words: string[], tags: Tags | null) => words.every(w => name.includes(w) || (tags?.[name] ?? '').includes(w))
const OUT: Keyframe[] = [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }]
const IN: Keyframe[] = [{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)' }]
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** every icon on screen plays its motion, one after another from the top left — the set's motion all at once */
function playAll() {
  const shown = [...document.querySelectorAll<SVGSVGElement>('.grid .cell svg')].filter(s => {
    const r = s.getBoundingClientRect()
    return r.bottom > 0 && r.top < innerHeight
  })
  shown.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)
  shown.slice(0, 220).forEach((s, i) => setTimeout(() => playIcon(s), i * 16))
}

interface Cells {
  look: Look
  /** the style on show (it changes after the grid has blurred out) */
  weight: Weight
  picked: Icon | undefined
  pick(i: Icon): void
}

export function Catalog({ look, picked, pick, category, phone }: Omit<Cells, 'weight'> & { category: string | null; phone?: ReactNode }) {
  const [q, setQ] = useState('')
  const [tags, setTags] = useState<Tags | null>(null)
  // the word its placeholder offers, a new one every few seconds while the field is empty
  const [hint, setHint] = useState(0)
  useEffect(() => {
    if (q) return
    const t = setInterval(() => setHint(h => (h + 1) % HINTS.length), 2600)
    return () => clearInterval(t)
  }, [q])
  const input = useRef<HTMLInputElement>(null)
  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q])
  const groupsEl = useRef<HTMLDivElement>(null)
  // what the grid shows, its category and its style. Either waits for the old to blur out where it stands, then comes:
  // another category as a new grid (its icons one after another), the other style on the same icons, blurring back in
  // all together — never a cut. (Not each icon's own change of style: on hundreds at once that played every icon's
  // motion and stuttered — Kivz.) A change under way always finishes; then the last thing asked for.
  const [shown, setShown] = useState<{ cat: string | null; weight: Weight }>({ cat: category, weight: look.weight })
  const cat = shown.cat
  const now = useRef(shown)
  const want = useRef(shown)
  want.current = { cat: category, weight: look.weight }
  const busy = useRef(false)
  useEffect(() => {
    const same = () => want.current.cat === now.current.cat && want.current.weight === now.current.weight
    if (busy.current || same()) return
    busy.current = true
    void (async () => {
      while (!same()) {
        const next = want.current
        const whole = next.cat !== now.current.cat
        const out = still() ? undefined : groupsEl.current?.animate(OUT, { duration: whole ? 180 : 200, easing: 'cubic-bezier(.12,0,.39,0)', fill: 'forwards' })
        await out?.finished.catch(() => {})
        now.current = next
        // (drawn at once, while nothing shows: the new grid, or every icon in its other style)
        flushSync(() => setShown(next))
        if (!whole && out && groupsEl.current) {
          const back = groupsEl.current.animate(IN, { duration: 450, easing: 'cubic-bezier(.61,1,.88,1)' })
          out.cancel()
          await back.finished.catch(() => {})
        }
      }
      busy.current = false
    })()
  }, [category, look.weight])

  useEffect(() => {
    if (words.length && !tags) void loadTags().then(setTags)
  }, [words.length, tags])
  const found = useMemo(
    () => GROUPS.filter(g => !cat || g.id === cat)
      .map(g => ({ g, names: words.length ? g.names.filter(n => matches(n, words, tags)) : g.names }))
      .filter(x => x.names.length),
    [words, tags, cat],
  )
  const where = cat ? GROUPS.find(g => g.id === cat)?.title : null

  // "/" goes to the search (unless you're typing somewhere already)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || /input|textarea|select/i.test((e.target as Element).tagName)) return
      e.preventDefault()
      input.current?.focus()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])

  // how many icons go to a row: an away block keeps its rows' height without drawing a box
  const [cols, setCols] = useState(18)
  useEffect(() => {
    const el = groupsEl.current!
    const ro = new ResizeObserver(() => {
      const grid = el.querySelector('.grid')
      const n = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : Math.floor((el.clientWidth + 2) / 50)
      setCols(Math.max(1, n))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [cat])

  const cells: Cells = { look, weight: shown.weight, picked, pick }
  return (
    <div className="page">
      <div data-in style={{ '--i': 1 } as CSSProperties}>
        <Hero />
      </div>

      {/* on a phone, the categories and then the look come here, between the banner and the search (Kivz) */}
      {phone && <div className="phone-rail" data-in style={{ '--i': 2 } as CSSProperties}>{phone}</div>}

      <div className="find" data-in style={{ '--i': 3 } as CSSProperties}>
        <label className="search">
          <MagnifyingGlass size={14} weight="outline" />
          <span className="search-field">
            <input
              ref={input}
              type="text"
              role="searchbox"
              value={q}
              aria-label={`Search ${COUNT.toLocaleString('en')} icons`}
              spellCheck={false}
              autoComplete="off"
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setQ('')}
            />
            {/* the placeholder, with a word in it that changes (blurring out and in where it stands) */}
            {!q && (
              <span className="search-hint" aria-hidden>
                Search {COUNT.toLocaleString('en')} icons for <Says text={HINTS[hint]} />
              </span>
            )}
          </span>
          {q && (
            <button type="button" className="search-clear" aria-label="Clear the search" onClick={() => { setQ(''); input.current?.focus() }}>
              <X size={14} weight="outline" />
            </button>
          )}
          {look.motion !== 'off' && (
            <button type="button" className="search-play" onClick={playAll} title="Every icon on screen plays its motion">
              <Play size={14} weight="outline" />
              Play all
            </button>
          )}
        </label>
      </div>

      {/* (keyed by the category: a new one comes in as a whole, rising like the page's parts) */}
      <div className="groups" ref={groupsEl} key={cat ?? 'all'} data-in style={{ '--i': 4 } as CSSProperties}>
        {found.map(({ g, names }) => (
          <section className="group" key={g.id} aria-label={g.title}>
            {!cat && <h2 className="muted">{g.title}</h2>}
            {Array.from({ length: Math.ceil(names.length / PER) }, (_, b) => (
              <Block key={`${b}:${names[b * PER]}`} group={g.id} names={names.slice(b * PER, (b + 1) * PER)} cols={cols} {...cells} />
            ))}
          </section>
        ))}
        {!found.length && <p className="muted">No icon for {q.trim()}{where ? ` in ${where}` : ''} yet.</p>}
      </div>
    </div>
  )
}

/**
 * up to ninety icons of a group, drawn only while the block is near the screen: coming in, its boxes breathe as
 * skeletons until its group's chunk is here, then its icons come one after another (reading order); far behind again,
 * it's an empty space as tall as its rows
 */
function Block({ group, names, cols, look, weight, picked, pick }: Cells & { group: string; names: string[]; cols: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const tall = useRef<number | null>(null)
  useEffect(() => {
    const el = ref.current!
    // (a block's ninety icons are drawn in between frames, not in one go: scrolling never waits for them)
    const io = new IntersectionObserver(([e]) => startTransition(() => setNear(e.isIntersecting)), { rootMargin: '400px 0px' })
    io.observe(el)
    // (the height it had while drawn: what it leaves behind)
    const ro = new ResizeObserver(() => { if (el.firstElementChild) tall.current = el.offsetHeight })
    ro.observe(el)
    return () => { io.disconnect(); ro.disconnect() }
  }, [])
  const icons = useGroup(group, near)
  const byName = useMemo(() => new Map(icons?.map(i => [i.data.name, i])), [icons])
  const size = Math.min(look.size, 40)
  const away = Math.ceil(names.length / cols) * 50 - 2
  return (
    <div ref={ref} className="block-of" style={near ? undefined : { height: tall.current ?? away }}>
      {near && (
        <ul className="grid">
          {names.map((name, k) => {
            const I = byName.get(name)
            return (
              <li key={name}>
                <button
                  type="button"
                  className={I ? 'cell' : 'cell cell-wait'}
                  style={{ '--k': k, '--row': Math.floor(k / cols) } as CSSProperties}
                  aria-label={name}
                  aria-pressed={!!I && picked === I}
                  onClick={() => I && pick(I)}
                >
                  {/* (keyed by its style: another style is another drawing, put there at once while the grid is out of
                      sight — the icon's own change of style would play its motion) */}
                  {I && <I key={weight} size={size} weight={weight} strokeWidth={look.stroke} animate={animateOf(I.data, look.motion)} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
