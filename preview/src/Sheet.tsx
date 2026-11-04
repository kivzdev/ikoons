import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'ikoons/icons/check'
import { Copy } from 'ikoons/icons/copy'
import { DownloadSimple as Download } from 'ikoons/icons/download-simple'
import { FileTypePng } from 'ikoons/icons/file-type-png'
import { FileTypeSvg } from 'ikoons/icons/file-type-svg'
import { X } from 'ikoons/icons/x'
import { Swap } from '@lib/core/create'
import type { Icon } from '@lib/core/types'
import { allGroups, entries } from '../../icons/catalog.ts'
import { animateOf, type Look } from './settings'
import { Says, Swaps } from './Controls'
import { copyPng, copyText, download, jsxOf, pngOf, svgOf } from './export'

// The icon pressed, in a sheet that rises from the foot of the window (Kivz's design, 2026-11-05): the icon on its
// tile, its name and what it does, the ways to take it — copy as SVG or PNG, download as SVG or PNG — and, past the
// rule, its React line. It goes back down with ×, Esc, or a second press on the same icon; another icon pressed while
// it's up takes its place without it moving.

const GROUP = new Map(allGroups.map(g => [g.id, g.title]))
const MOTION: Record<string, string> = {
  nudge: 'nudges', exit: 'goes out and comes back', swing: 'swings', open: 'opens', beat: 'beats', turn: 'turns',
  spin: 'spins', draw: 'is drawn again', orbit: 'loops on the spot', hop: 'hops', lift: 'lifts', twinkle: 'twinkles',
  pop: 'pops', jitter: 'shakes', flip: 'flips', jelly: 'stretches like a jelly', waves: 'sends out waves', blink: 'blinks',
  drift: 'drifts', grow: 'grows back', spread: 'spreads', combo: 'moves', brand: 'takes its colour',
}
const said = (icon: Icon) => {
  const e = entries.get(icon.data.name)
  if (!e) return ''
  return `${GROUP.get(e.group) ?? ''} · ${MOTION[e.motion[0]] ?? e.motion[0]}${e.loop ? ', on and on' : ''}`
}

type Done = 'svg' | 'png' | 'svg↓' | 'png↓' | 'jsx' | null

/** a row of equal boxes under one highlight that comes under the one hovered and glides between them */
function Row({ label, children }: { label: string; children: (bind: (i: number) => object) => ReactNode }) {
  // (nothing rests lit: the highlight only comes under the box the pointer or the focus is on)
  const [hot, setHot] = useState<number | null>(null)
  const at = hot ?? -1
  return (
    <div className="sheet-row">
      <span className="label muted">{label}</span>
      <div className="pills-x sheet-boxes" onPointerLeave={() => setHot(null)}>
        <span className="pill" aria-hidden style={{ width: '50%', transform: `translateX(${Math.max(at, 0) * 100}%)`, opacity: at < 0 ? 0 : 1 }} />
        {children(i => ({ 'data-on': i === at ? '' : undefined, onPointerEnter: () => setHot(i), onFocus: () => setHot(i), onBlur: () => setHot(null) }))}
      </div>
    </div>
  )
}

export function Sheet({ icon, open, look, close }: { icon: Icon | undefined; open: boolean; look: Look; close(): void }) {
  const [done, setDone] = useState<Done>(null)
  const timer = useRef(0)
  const flash = (what: Done) => {
    setDone(what)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setDone(null), 1400)
  }
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [open, close])

  const name = icon?.data.name ?? ''
  const ink = look.colour === 'current' ? 'var(--fg)' : look.colour
  const act = icon && {
    svg: () => copyText(svgOf(icon, look)).then(() => flash('svg')),
    png: () => copyPng(pngOf(icon, look)).then(() => flash('png')),
    'svg↓': async () => { download(`${name}.svg`, svgOf(icon, look)); flash('svg↓') },
    'png↓': () => pngOf(icon, look).then(b => { download(`${name}.png`, b); flash('png↓') }),
    jsx: () => copyText(jsxOf(icon, look)).then(() => flash('jsx')),
  }
  const run = (k: Exclude<Done, null>) => () => void act?.[k]().catch(() => flash(null))
  // done: the box's own icon turns into a tick for a moment (its words stay as they are, so nothing in the row moves);
  // copy → check is a pair of the set's own, so the sheets slide into one and the tick is drawn
  const mark = (k: Exclude<Done, null>, Base: Icon) => <Swap icon={done === k ? Check : Base} size={14} weight="outline" animate={false} />
  const line = icon ? jsxOf(icon, look).split('\n').pop()! : ''

  return (
    <aside className="sheet" data-open={open ? '' : undefined} aria-hidden={!open} inert={!open} aria-label={`${name}: copy or download`}>
      <div className="sheet-tile" data-icon-trigger="" style={{ color: ink }}>
        {/* (another style: the drawing blurs out and back in as the other one, as the grid does — not the icon's own fill,
            which plays its motion) */}
        {icon && (
          <Swaps k={look.weight}>
            <Swap key={look.weight} icon={icon} size={Math.max(28, Math.min(look.size, 64))} weight={look.weight} strokeWidth={look.stroke} animate={animateOf(icon.data, look.motion)} />
          </Swaps>
        )}
      </div>
      <div className="sheet-main">
        <div className="sheet-head">
          <Says className="sheet-name" text={name} />
          <Says className="sheet-sub muted" text={icon ? said(icon) : ''} />
        </div>
        <div className="sheet-rows">
          <Row label="Copy as:">
            {bind => (
              <>
                <button type="button" className="btn" onClick={run('svg')} {...bind(0)}>{mark('svg', FileTypeSvg)}SVG</button>
                <button type="button" className="btn" onClick={run('png')} {...bind(1)}>{mark('png', FileTypePng)}PNG</button>
              </>
            )}
          </Row>
          <Row label="Download as:">
            {bind => (
              <>
                <button type="button" className="btn" onClick={run('svg↓')} {...bind(0)}>{mark('svg↓', Download)}SVG</button>
                <button type="button" className="btn" onClick={run('png↓')} {...bind(1)}>{mark('png↓', Download)}PNG</button>
              </>
            )}
          </Row>
        </div>
      </div>
      <div className="sheet-code">
        <span className="label muted">React:</span>
        <button type="button" className="sheet-line" onClick={run('jsx')} title="Copy the import and the line">
          <code>{line}</code>
          <span className="sheet-copy" aria-label="Copy">{mark('jsx', Copy)}</span>
        </button>
        <p className="sheet-note muted">
          {look.size} px{look.weight === 'outline' || icon?.data.filled === undefined ? `, lines ${look.stroke}` : ''} · the PNG at twice that
        </p>
      </div>
      <button type="button" className="sheet-close" aria-label="Close" onClick={close}><X weight="outline" /></button>
      {/* (said out loud for a screen reader; nothing shows) */}
      <span className="sr-only" aria-live="polite">{done ? (done.endsWith('↓') ? 'Saved' : 'Copied') : ''}</span>
    </aside>
  )
}
