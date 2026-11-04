import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { BookOpen } from 'ikoons/icons/book-open'
import { GithubLogo } from 'ikoons/icons/github-logo'
import { GridFour } from 'ikoons/icons/grid-four'
import { IkoonsLogo } from 'ikoons/icons/ikoons-logo'
import { IconProvider } from '@lib/core/context'
import type { Icon } from '@lib/core/types'
import { WORD } from './art'
import { Catalog } from './Catalog'
import { Stack } from './Controls'
import { Creator } from './Creator'
import { Docs, Outline } from './Docs'
import { Categories, LookControls } from './Look'
import { Link, usePath } from './router'
import { scrollToY } from './scroll'
import { useLook } from './settings'
import { Sheet } from './Sheet'

const TITLE = { icons: 'Ikoons — icons that move', docs: 'Docs — Ikoons' }

/** the wordmark: the set's star (it twinkles when hovered: it's the set's own icon) and the word, from the design; under
 *  the word, small and grey, whose it is */
function Logo() {
  return (
    <div className="brand">
      <Link to="/" className="logo" aria-label="ikoons">
        <IkoonsLogo size={22} />
        <svg viewBox="70.5 41.5 63 17.5" width="63" height="17.5" fill="currentColor" aria-hidden>
          {WORD.map(w => <path key={w.d} d={w.d} fillRule={w.evenodd && 'evenodd'} />)}
        </svg>
      </Link>
      <a className="byline" href="https://kivz.dev">by kivz</a>
    </div>
  )
}

/**
 * ikoons.kivz.dev (Kivz's design, 2026-11-05): the left rail — the wordmark, the pages, then more from the creator; the
 * middle — the banner, the search and the icons (or the docs); the right rail — how the icons look, then the categories
 * (or, on the docs, their sections). An icon pressed rises in a sheet at the foot of the window. A page changes by
 * blurring out where it stands and the next one blurring in.
 */
export function App() {
  const path = usePath()
  const page = path.startsWith('/docs') ? 'docs' : 'icons'
  const [look, set] = useLook()
  const [picked, setPicked] = useState<Icon | undefined>()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string | null>(null)

  // pressing an icon raises the sheet with it; pressing it again lowers it
  const pick = useCallback((i: Icon) => {
    setOpen(o => !(o && picked === i))
    setPicked(i)
  }, [picked])
  const close = useCallback(() => setOpen(false), [])
  // a category: the middle shows only its icons, from the top of the grid
  const choose = (id: string | null) => {
    setCategory(id)
    const find = document.querySelector('.find')
    if (find && find.getBoundingClientRect().top < 0) scrollToY(find.getBoundingClientRect().top + scrollY - 40)
  }

  // the page that shows: everything that belongs to the old one — the middle, the right rail, the left rail's look and
  // categories — blurs out where it stands first, then the new page's parts blur in in their places (Kivz: "it cuts")
  const [shown, setShown] = useState(page)
  const came = useRef(false) // (the first page comes in with the page's own rise, not this)
  const col = useRef<HTMLElement>(null)
  useEffect(() => {
    document.title = TITLE[page]
    if (page === shown) return
    setOpen(false)
    came.current = true
    const parts = [col.current, ...document.querySelectorAll<HTMLElement>('.rail-part, .rail-l-more')].filter(Boolean) as HTMLElement[]
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const outs = still ? [] : parts.map(el => el.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: 200, easing: 'cubic-bezier(.12,0,.39,0)', fill: 'forwards' }))
    const next = () => setShown(page)
    if (!outs.length) next()
    else Promise.all(outs.map(o => o.finished)).then(next, next)
  }, [page, shown])
  const swap = came.current ? '' : undefined

  const look_ = <LookControls look={look} set={set} />
  const cats = <Categories active={category} choose={choose} />
  return (
    <IconProvider reducedMotion="user">
      <div className="site" data-sheet={open ? '' : undefined}>
        <aside className="rail rail-l" data-in style={{ '--i': 0 } as CSSProperties}>
          <Logo />
          <Stack label="Pages" active={page === 'docs' ? 1 : 0}>
            {bind => (
              <>
                <Link to="/" className="btn" aria-current={page === 'icons' ? 'page' : undefined} {...bind(0)}><GridFour weight="outline" />Icons</Link>
                <Link to="/docs" className="btn" aria-current={page === 'docs' ? 'page' : undefined} {...bind(1)}><BookOpen weight="outline" />Docs</Link>
                <a href="https://github.com/kivzdev/ikoons" className="btn" {...bind(2)}><GithubLogo />GitHub</a>
              </>
            )}
          </Stack>
          {/* (narrower than the frame there's no right rail: its look and categories come here — on a phone, into the
              middle under the banner instead) */}
          {shown === 'icons' && <div className="rail-l-more" key={shown} data-came={swap}>{look_}{cats}</div>}
          <Creator />
        </aside>

        <main className="col" ref={col} key={shown} data-came={swap}>
          {shown === 'docs' ? <Docs /> : <Catalog look={look} picked={open ? picked : undefined} pick={pick} category={category} phone={<>{cats}{look_}</>} />}
        </main>

        <aside className="rail rail-r" data-in style={{ '--i': 2 } as CSSProperties}>
          <div className="rail-part" key={shown} data-came={swap}>
            {shown === 'docs' ? <Outline /> : <>{look_}{cats}</>}
          </div>
        </aside>
      </div>
      {shown === 'icons' && <Sheet icon={picked} open={open} look={look} close={close} />}
    </IconProvider>
  )
}
