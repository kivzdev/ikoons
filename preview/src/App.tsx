import { useRef, useState, type CSSProperties } from 'react'
import { IconProvider, KivzLogo, playIcon, Swap, type Icon, type Weight } from '@kivzdev/icons'
import { all } from '@kivzdev/icons/all'
import { entries, groups, pairs, type Entry } from '../../icons/catalog.ts'
import { Switch } from './Switch'

const byName = new Map<string, Icon>(all.map(i => [i.data.name, i]))
const drawn = (name: string) => byName.has(name)

// the label column is 128 px: the groups go by short names here
const LABEL: Record<string, string> = {
  navigation: 'Navigation', actions: 'Actions', communication: 'Communication', media: 'Media', files: 'Files',
  people: 'People', status: 'Status', time: 'Time, place', shopping: 'Shopping', devices: 'Devices',
  games: 'Games, design', nature: 'Nature', brands: 'Brands',
}

const MOTION: Record<string, string> = {
  nudge: 'nudge', exit: 'out and back', swing: 'swing', open: 'opens', beat: 'beat', turn: 'turn', spin: 'spin',
  draw: 'drawn', orbit: 'small loop', hop: 'hop', lift: 'lift', twinkle: 'twinkle', pop: 'pop', jitter: 'shake',
  flip: 'flip', jelly: 'jelly', waves: 'waves', blink: 'blink', drift: 'drift', grow: 'grow', spread: 'spread',
  combo: 'together', brand: 'its colour',
}
const motionOf = (e: Entry) => {
  const [r, p = {}] = e.motion
  if (r === 'turn' && typeof p.angle === 'number') return `turn ${Math.abs(p.angle)}°${p.back ? ' and back' : ''}`
  return MOTION[r] + (e.loop ? ', on and on' : '')
}
/** the layers its motion looks for, as a phrase */
const partsOf = (e: Entry): string[] => {
  const [r, p = {}] = e.motion
  if (r === 'combo') return (p.of as [string, Record<string, unknown>][]).flatMap(m => partsOf({ ...e, motion: m as Entry['motion'] }))
  const keys = ['part', 'follow', 'inner', 'main', 'small', 'glints'].map(k => p[k]).filter((v): v is string => typeof v === 'string')
  return [...keys, ...((p.parts as string[]) ?? [])]
}

export function App() {
  const [weight, setWeight] = useState<Weight>('filled')
  const [stroke, setStroke] = useState(2)
  const [size, setSize] = useState(20)
  const [still, setStill] = useState(false)
  const [picked, setPicked] = useState<Icon>(byName.get('bell') ?? all[0])

  const real = all.filter(i => !i.data.placeholder)
  const stand = all.filter(i => i.data.placeholder)
  const left = [...entries.values()].filter(e => !drawn(e.name))

  return (
    <IconProvider weight={weight} strokeWidth={stroke} reducedMotion={still ? 'always' : 'user'}>
      <div className="site">
        <aside className="rail" data-in style={{ '--i': 0 } as CSSProperties}>
          <a className="logo" href="https://kivz.dev" aria-label="kivz.dev">
            <KivzLogo size={20} />
          </a>
          <div className="controls">
            <Switch<Weight> label="Weight" value={weight} onChange={setWeight} options={[{ value: 'filled', label: 'Filled' }, { value: 'outline', label: 'Outline' }]} />
            <Switch label="Lines" value={stroke} onChange={setStroke} options={[1.5, 2, 2.5].map(v => ({ value: v, label: String(v) }))} />
            <Switch label="Size" value={size} onChange={setSize} options={[14, 20, 24].map(v => ({ value: v, label: String(v) }))} />
            <Switch label="Motion" value={still} onChange={setStill} options={[{ value: false, label: 'On' }, { value: true, label: 'Reduced' }]} />
          </div>
        </aside>

        <main className="col">
          <div className="page">
            <header className="hello" data-in style={{ '--i': 1 } as CSSProperties}>
              <h1>Icons</h1>
              <p className="muted">
                Kivz’s own set, for React: filled by default, outline at any line width, and every icon moves its own
                way. Hover one, or press a row to look at it closer.
              </p>
            </header>

            <Stage icon={picked} />

            {real.length > 0 && (
              <Rows title="Drawn by Kivz" detail={`${real.length}`} icons={real} size={size} picked={picked} pick={setPicked} i={3} />
            )}
            <Rows
              title="Placeholders"
              detail={`${stand.length} — stand-ins so the motions have something to run on, until the real drawings land`}
              icons={stand}
              size={size}
              picked={picked}
              pick={setPicked}
              i={4}
            />

            <States size={size} />

            <section className="block" data-in style={{ '--i': 6 } as CSSProperties}>
              <h2>
                <span>To draw</span>
                <span className="muted">{left.length} of {entries.size} · the white ones first (★)</span>
              </h2>
              <ul className="years">
                {groups.map(g => {
                  const names = g.icons.filter(e => !drawn(e.name))
                  if (!names.length) return null
                  return (
                    <li className="year" key={g.id}>
                      <span className="y muted">{LABEL[g.id]}</span>
                      <p className="names">
                        {names.map(e => <span key={e.name} className={e.star ? 'first' : undefined}>{e.name}</span>)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="block" data-in style={{ '--i': 7 } as CSSProperties}>
              <h2>Adding one</h2>
              <div className="prose muted">
                <p>
                  Draw it in Figma on a 24 × 24 frame, in one colour: lines 2 wide (1.17 px at 14 px, like kivz.dev’s
                  rail), centred on the path, round caps and joins; filled shapes solid, details cut out of them.
                </p>
                <p>
                  Name the layers its motion moves — the caption under the plate says which (a bell’s <code>clapper</code>,
                  a bin’s <code>lid</code>). A layer named <code>fx-…</code> only shows while the icon moves.
                </p>
                <p>
                  Export with “Include id attribute” to <code>icons/filled/name.svg</code> and{' '}
                  <code>icons/outline/name.svg</code> (frames named <code>filled/name</code> export there). This page
                  picks it up as you save; <code>npm run build</code> makes the package.
                </p>
              </div>
            </section>
          </div>
        </main>
      </div>
    </IconProvider>
  )
}

function Stage({ icon }: { icon: Icon }) {
  const e = entries.get(icon.data.name)!
  const refs = useRef<(SVGSVGElement | null)[]>([])
  const at = (i: number) => (el: SVGSVGElement | null) => void (refs.current[i] = el)
  const parts = [...new Set(partsOf(e))]
  const pair = pairs.find(p => (p[0] === e.name && drawn(p[1])) || (p[1] === e.name && drawn(p[0])))
  const Replay = byName.get('arrow-counter-clockwise')
  return (
    <figure className="figure" data-in style={{ '--i': 2 } as CSSProperties}>
      <div className="plate" data-icon-trigger="">
        <div className="plate-big">
          <Swap icon={icon} weight="filled" ref={at(0)} />
          <Swap icon={icon} weight="outline" ref={at(1)} />
        </div>
        <div className="plate-sizes">
          {[14, 20, 24, 32].map((s, i) => (
            <figure key={s}>
              <Swap icon={icon} size={s} ref={at(i + 2)} />
              <figcaption>{s}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="figure-bar">
        <button type="button" className="btn btn-solo" onClick={() => refs.current.forEach(playIcon)}>
          {Replay && <Replay />}
          Replay
        </button>
      </div>
      <p className="caption">
        <b>{e.name}</b> — {motionOf(e)}
        {parts.length > 0 && <>, moving its layer{parts.length > 1 ? 's' : ''} {parts.map(p => `“${p}”`).join(', ')}</>}
        {pair && <>; becomes {pair[0] === e.name ? pair[1] : pair[0]} by {pair[2][0]}</>}
        {icon.data.placeholder ? ' · placeholder drawing' : ' · Kivz’s drawing'}
        {e.idea && <><br /><q className="idea">{e.idea}</q></>}
      </p>
    </figure>
  )
}

function Rows({ title, detail, icons, size, picked, pick, i }: { title: string; detail: string; icons: Icon[]; size: number; picked: Icon; pick(i: Icon): void; i: number }) {
  const mine = new Set(icons.map(x => x.data.name))
  return (
    <section className="block" data-in style={{ '--i': i } as CSSProperties}>
      <h2>
        <span>{title}</span>
        <span className="muted">{detail}</span>
      </h2>
      <ul className="years">
        {groups.map(g => {
          const here = g.icons.filter(e => mine.has(e.name))
          if (!here.length) return null
          return (
            <li className="year" key={g.id}>
              <span className="y muted">{LABEL[g.id]}</span>
              <ul className="items">
                {here.map(e => {
                  const I = byName.get(e.name)!
                  return (
                    <li key={e.name}>
                      <button type="button" className="row" aria-current={picked === I} onClick={() => pick(I)}>
                        <span className="row-icon"><I size={size} /></span>
                        <span className="row-title">{e.name}{e.star ? ' ★' : ''}</span>
                        <span className="row-detail">{motionOf(e)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** the changes of state: press a row and it changes; press again (even halfway) and it changes back */
function States({ size }: { size: number }) {
  const [on, setOn] = useState<Record<string, boolean>>({})
  const rows: { key: string; label: string; show(on: boolean): Icon; weight?: (on: boolean) => Weight; how: string; animate?: false }[] = []
  for (const [a, b, [how]] of pairs) {
    const A = byName.get(a)
    const B = byName.get(b)
    if (A && B) rows.push({ key: `${a}>${b}`, label: `${a} → ${b}`, show: o => (o ? B : A), how, animate: false })
  }
  for (const name of ['heart', 'star', 'bookmark-simple', 'bell']) {
    const I = byName.get(name)
    if (I) rows.push({ key: `${name}:fill`, label: `${name}: outline → filled`, show: () => I, weight: o => (o ? 'filled' : 'outline'), how: 'fills in, with its motion', animate: false })
  }
  const Spinner = byName.get('spinner')
  const Check = byName.get('check')
  if (Spinner && Check) rows.push({ key: 'spinner>check', label: 'spinner → check', show: o => (o ? Check : Spinner), how: 'blur in place' })
  return (
    <section className="block" data-in style={{ '--i': 5 } as CSSProperties}>
      <h2>
        <span>Changes</span>
        <span className="muted">press a row; press again, even halfway, and it turns round where it is</span>
      </h2>
      <ul className="years">
        <li className="year">
          <span className="y muted">Swap</span>
          <ul className="items">
            {rows.map(r => {
              const o = !!on[r.key]
              return (
                <li key={r.key}>
                  <button type="button" className="row" aria-pressed={o} onClick={() => setOn(s => ({ ...s, [r.key]: !s[r.key] }))}>
                    <span className="row-icon">
                      <Swap icon={r.show(o)} size={size} weight={r.weight?.(o)} animate={r.animate} />
                    </span>
                    <span className="row-title">{r.label}</span>
                    <span className="row-detail">{r.how === 'swap' ? 'blur in place' : r.how}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </li>
      </ul>
    </section>
  )
}
