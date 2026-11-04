import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { scrollToY } from './scroll'

// A path is the state: no library. A link pushes the path; back and forward come in through popstate.
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(f => f())
if (typeof window !== 'undefined') window.addEventListener('popstate', emit)

export function go(to: string) {
  if (to === location.pathname + location.hash) return
  history.pushState(null, '', to)
  emit()
  scrollToY(0, false)
}

export function usePath() {
  const [path, setPath] = useState(() => location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    listeners.add(on)
    return () => void listeners.delete(on)
  }, [])
  return path
}

/** an in-site link: a plain <a> (it opens in a new tab like one), but a plain click changes the page in place */
export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    go(to)
  }
  return <a href={to} onClick={click} {...rest} />
}
