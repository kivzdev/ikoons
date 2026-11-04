import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Swap } from '@lib/core/create'
import type { Icon, Weight } from '@lib/core/types'
import { entries, pairs } from '../../icons/catalog.ts'
import { useIcons } from './icons'
import { scrollToY } from './scroll'

// The documentation: how to install the set, use an icon, set its look and its motion, change one icon into another,
// make icons of your own and draw for the set. One column; its sections are listed in the right rail.

export const SECTIONS = [
  ['install', 'Install'],
  ['use', 'Use'],
  ['props', 'Props'],
  ['provider', 'Defaults'],
  ['motion', 'When they move'],
  ['changes', 'Changes of state'],
  ['own', 'Icons of your own'],
  ['drawing', 'Drawing for the set'],
  ['license', 'License'],
] as const

function Code({ children }: { children: string }) {
  const [done, setDone] = useState(false)
  const icons = useIcons(['copy', 'check'])
  const Copy = icons.get('copy'), Check = icons.get('check')
  return (
    <div className="code">
      <pre><code>{children}</code></pre>
      {/* copied: the icon turns into a tick (copy → check, the set's own change); the words never change */}
      <button type="button" className="btn btn-solo code-copy" aria-label="Copy" onClick={() => void navigator.clipboard.writeText(children).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) })}>
        {Copy && Check && <Swap icon={done ? Check : Copy} size={14} weight="outline" animate={false} />}
        Copy
      </button>
    </div>
  )
}

function Section({ id, title, i, children }: { id: string; title: string; i: number; children: ReactNode }) {
  return (
    <section className="block doc" id={id} data-in style={{ '--i': i } as CSSProperties}>
      <h2>{title}</h2>
      <div className="prose">{children}</div>
    </section>
  )
}

/** a ruled table: a label column and its rows */
function Table({ rows }: { rows: [label: ReactNode, text: ReactNode][] }) {
  return (
    <ul className="years">
      {rows.map(([label, text], k) => (
        <li className="year" key={k}>
          <span className="y">{label}</span>
          <p className="cellt muted">{text}</p>
        </li>
      ))}
    </ul>
  )
}

const RECIPES: [string, string][] = [
  ['nudge', 'a push one way and back, with a breath the other way first'],
  ['exit', 'out through an edge and back in from the other side'],
  ['swing', 'hangs from a point and swings, dying away'],
  ['turn', 'turns and settles a hair past'],
  ['spin', 'round and round, never at an even speed'],
  ['hop', 'a hop on gravity, squashing as it lands'],
  ['lift', 'a part lifts and is set back down'],
  ['open', 'a part opens on its hinge and shuts with a bounce'],
  ['draw', 'its lines are drawn again, one after another'],
  ['waves', 'waves go out from a source, one after another'],
  ['grow', 'parts shrink away and grow back one by one'],
  ['spread', 'two parts push apart and come back together'],
  ['beat', 'a heartbeat: swells, eases, swells again'],
  ['jelly', 'stretches from where it’s held and settles'],
  ['jitter', 'shakes and settles'],
  ['blink', 'closes and opens'],
  ['twinkle', 'swells and turns; the small ones pop back'],
  ['flip', 'flips over like a coin'],
  ['orbit', 'a small loop on the spot'],
  ['drift', 'floats off a little and back, slowly'],
  ['pop', 'pressed in, then out a touch past its size'],
]
/** the first icon in the set that moves the recipe's way */
const exampleOf = (recipe: string) => [...entries.values()].find(e => e.motion[0] === recipe)?.name
const FILLS = ['heart', 'star', 'bookmark-simple']

export function Docs() {
  return (
    <div className="page">
      <header className="hello" data-in style={{ '--i': 1 } as CSSProperties}>
        <h1>Docs</h1>
        <p className="muted">Everything the package does, in the order you’ll need it.</p>
      </header>

      <Section id="install" title="Install" i={2}>
        <p>Ikoons is a React package with no dependencies of its own (React 18 or later). It isn’t on npm yet — it will be soon, as:</p>
        <Code>npm install ikoons</Code>
      </Section>

      <Section id="use" title="Use" i={3}>
        <p>Every icon is a component of its own, named after it (<code>bell</code> is <code>Bell</code>, also exported as <code>BellIcon</code>). Import the ones you use; a bundler leaves the rest out.</p>
        <Code>{`import { Bell, Trash } from 'ikoons'

<button>
  <Bell /> Notifications
</button>`}</Code>
        <p>It’s as big as the text beside it (<code>1em</code>) and takes the text’s colour (<code>currentColor</code>). When its button is hovered — or reached with the keyboard — it plays its motion: the bell swings, the bin’s lid opens.</p>
      </Section>

      <Section id="props" title="Props" i={4}>
        <Table rows={[
          [<code>size</code>, <>A number (px) or any CSS length. <code>1em</code> by default.</>],
          [<code>weight</code>, <><code>"filled"</code> (the default) or <code>"outline"</code>. Changing it fills the icon in, or empties it, with its motion. Where an icon has no filled drawing yet, it shows its outline.</>],
          [<code>strokeWidth</code>, <>The width of its lines on the 24-unit grid: <code>2</code> by default (1.17 px at 14 px). A thinner detail keeps its share.</>],
          [<code>animate</code>, <><code>"hover"</code> (the default), <code>"press"</code>, <code>"loop"</code> (a loader’s default) or <code>false</code>.</>],
          [<code>cue</code>, <>Plays the motion whenever this value changes: <code>{'cue={count}'}</code> for a new notification.</>],
          [<code>title</code>, <>A name for screen readers. Without one the icon is decoration (<code>aria-hidden</code>).</>],
          [<code>…</code>, <>Any SVG prop: <code>color</code>, <code>className</code>, <code>style</code>, <code>ref</code>, <code>onClick</code>…</>],
        ]} />
      </Section>

      <Section id="provider" title="Defaults" i={5}>
        <p>Set the props once for a part of the page; an icon’s own props still win.</p>
        <Code>{`import { IconProvider } from 'ikoons'

<IconProvider size={20} weight="outline" strokeWidth={1.5}>
  <App />
</IconProvider>`}</Code>
        <p>It also takes <code>reducedMotion</code>: <code>"user"</code> (the default) follows the visitor’s setting, where a motion becomes a calm fade; <code>"always"</code> and <code>"never"</code> decide for them.</p>
      </Section>

      <Section id="motion" title="When they move" i={6}>
        <p>An icon listens to the nearest button, link, tab or menu item it’s in (or anything marked <code>data-icon-trigger</code>), so a whole row can set it off. A motion is never cut short: hover again while it plays and it carries on; whatever is asked for meanwhile happens when it’s done, the last of it only.</p>
        <Code>{`import { playIcon } from 'ikoons'

const bell = useRef<SVGSVGElement>(null)
<Bell ref={bell} animate={false} />
playIcon(bell.current) // from anywhere: a message arrived`}</Code>
      </Section>

      <Section id="changes" title="Changes of state" i={7}>
        <p><code>Swap</code> shows one icon at a time and goes from one to the next — with the pair’s own change where it has one (play turns into pause, the moon rises into the sun), by blurring in place where it doesn’t. Press a row; press again, even halfway, and it turns round where it is.</p>
        <Code>{`import { Pause, Play, Swap } from 'ikoons'

<Swap icon={playing ? Pause : Play} />`}</Code>
        <Changes />
      </Section>

      <Section id="own" title="Icons of your own" i={8}>
        <p><code>createIcon</code> makes a component from a drawing, and <code>ikoons/motion</code> has the motions the set is made with. Each takes the name of the layer it moves (a bell’s <code>clapper</code>); without it, the whole icon moves. Hover a row to see one.</p>
        <Code>{`import { createIcon } from 'ikoons'
import { swing } from 'ikoons/motion'

export const Lamp = createIcon('lamp', { outline }, { motion: swing({ follow: 'shade' }) })`}</Code>
        <Recipes />
      </Section>

      <Section id="drawing" title="Drawing for the set" i={9}>
        <p>The set’s drawings are SVG files, <code>icons/filled/name.svg</code> and <code>icons/outline/name.svg</code>, made in Figma: a 24 × 24 frame, one colour, lines 2 wide with round caps and joins, details cut out of filled shapes.</p>
        <p>The layers a motion moves are named, in lowercase — a bell’s <code>clapper</code>, a bin’s <code>lid</code>, the <code>ray</code>s of a sun; a layer named <code>fx-…</code> only shows while it moves. Export with <em>Include “id” attribute</em> on; frames named <code>filled/bell</code> and <code>outline/bell</code> land in their folders.</p>
      </Section>

      <Section id="license" title="License" i={10}>
        <p>MIT, © Kivz. Until Kivz’s own drawings take their place, the drawings are <a className="u" href="https://tabler.io/icons">Tabler Icons</a>’ (MIT, © Paweł Kuna), their lines named for the motions. Logos are trademarks of their owners.</p>
      </Section>
    </div>
  )
}

/** the pairs, live: press a row to change it, and again to change it back */
function Changes() {
  const [on, setOn] = useState<Record<string, boolean>>({})
  const byName = useIcons([...pairs.flatMap(([a, b]) => [a, b]), ...FILLS])
  const rows: { key: string; label: string; show(on: boolean): Icon; weight?(on: boolean): Weight; how: string }[] = []
  for (const [a, b, [how]] of pairs) {
    const A = byName.get(a)
    const B = byName.get(b)
    if (A && B) rows.push({ key: `${a}>${b}`, label: `${a} → ${b}`, show: o => (o ? B : A), how })
  }
  for (const name of FILLS) {
    const I = byName.get(name)
    if (I) rows.push({ key: `${name}:fill`, label: `${name}, outline → filled`, show: () => I, weight: o => (o ? 'filled' : 'outline'), how: 'fills in' })
  }
  const HOW: Record<string, string> = { morph: 'changes shape', sunrise: 'rises', unlock: 'unlocks', slash: 'is struck through', copied: 'is copied', swap: 'blurs in place', 'fills in': 'fills in' }
  return (
    <ul className="years">
      <li className="year">
        <span className="y muted">Swap</span>
        <ul className="items">
          {rows.map(r => {
            const o = !!on[r.key]
            return (
              <li key={r.key}>
                <button type="button" className="row" aria-pressed={o} onClick={() => setOn(s => ({ ...s, [r.key]: !s[r.key] }))}>
                  <span className="row-icon"><Swap icon={r.show(o)} size={20} weight={r.weight?.(o) ?? 'outline'} animate={false} /></span>
                  <span className="row-title">{r.label}</span>
                  <span className="row-detail">{HOW[r.how] ?? r.how}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </li>
    </ul>
  )
}

/** the motions, each on an icon that moves that way: hover a row */
function Recipes() {
  const byName = useIcons(RECIPES.map(([r]) => exampleOf(r)).filter((n): n is string => !!n))
  return (
    <ul className="years">
      <li className="year">
        <span className="y muted">ikoons/motion</span>
        <ul className="items">
          {RECIPES.map(([name, text]) => {
            const ex = exampleOf(name)
            const I = ex ? byName.get(ex) : undefined
            return (
              <li key={name}>
                <button type="button" className="row">
                  <span className="row-icon">{I && <I size={20} weight="outline" />}</span>
                  <span className="row-title"><code>{name}</code> <span className="muted">{text}</span></span>
                </button>
              </li>
            )
          })}
        </ul>
      </li>
    </ul>
  )
}

/** the sections, in the right rail: the one you're reading is white */
export function Outline() {
  const [at, setAt] = useState<string>(SECTIONS[0][0])
  useEffect(() => {
    let raf = 0
    const read = () => {
      raf = 0
      const line = innerHeight / 3
      let cur: string = SECTIONS[0][0]
      for (const [id] of SECTIONS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) cur = id
      }
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) cur = SECTIONS[SECTIONS.length - 1][0]
      setAt(cur)
    }
    const on = () => void (raf ||= requestAnimationFrame(read))
    read()
    addEventListener('scroll', on, { passive: true })
    addEventListener('resize', on)
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])
  return (
    <nav className="outline" aria-label="On this page">
      {SECTIONS.map(([id, title]) => (
        <a key={id} href={`#${id}`} aria-current={at === id ? 'true' : undefined} onClick={e => {
          e.preventDefault()
          const el = document.getElementById(id)
          if (el) scrollToY(el.getBoundingClientRect().top + scrollY - 112)
        }}>{title}</a>
      ))}
    </nav>
  )
}
