// What sets an icon off: the thing you'd point at — the button, link, tab or row it sits in (or itself, when it's in
// nothing you can press). Hover means a mouse or a pen over it, or a keyboard focus ring on it; a finger has no hover,
// so on touch a hover motion plays when it's tapped.

const TRIGGER = [
  '[data-icon-trigger]', 'a[href]', 'button', 'summary', 'label', '[role="button"]', '[role="link"]', '[role="tab"]',
  '[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="menuitemradio"]', '[role="option"]', '[role="switch"]',
  '[role="checkbox"]', '[role="radio"]',
].join(', ')

/** the element whose hover and press set the icon off */
export const triggerOf = (svg: Element): Element => svg.parentElement?.closest(TRIGGER) ?? svg

const focusVisible = (el: Element) => {
  try {
    return el.matches(':focus-visible')
  } catch {
    return false
  }
}

export interface Bind {
  /** `hover` plays on hover and keyboard focus (and on a tap, where there's no hover); `press` on a press */
  mode: 'hover' | 'press'
  play(): void
  /** for logos: a state that lasts while it's hovered */
  hover?(on: boolean): void
}

export function bind(svg: SVGSVGElement, { mode, play, hover }: Bind): () => void {
  const el = triggerOf(svg)
  const fine = (e: PointerEvent) => e.pointerType !== 'touch'
  const on: [string, EventListener][] = [
    ['pointerenter', e => {
      if (!fine(e as PointerEvent)) return
      hover?.(true)
      if (mode === 'hover') play()
    }],
    ['pointerleave', e => {
      if (fine(e as PointerEvent)) hover?.(false)
    }],
    ['pointerdown', e => {
      if (mode === 'press' || !fine(e as PointerEvent)) play()
    }],
    ['keydown', e => {
      const k = e as KeyboardEvent
      if (mode === 'press' && !k.repeat && (k.key === 'Enter' || k.key === ' ')) play()
    }],
    ['focusin', e => {
      if (!focusVisible(e.target as Element)) return
      hover?.(true)
      if (mode === 'hover') play()
    }],
    ['focusout', () => hover?.(false)],
  ]
  for (const [type, fn] of on) el.addEventListener(type, fn)
  return () => {
    for (const [type, fn] of on) el.removeEventListener(type, fn)
  }
}

// the site's spring (3.5 % past) as CSS, for the logo's lift — a plain ease-out where linear() isn't known
const SPRING = 'linear(0, 0.137, 0.269, 0.394, 0.512, 0.617, 0.711, 0.792, 0.86, 0.916, 0.959, 0.992, 1.015, 1.029, 1.035, 1.034, 1.033, 1.031, 1.028, 1.026, 1.023, 1.02, 1.017, 1.014, 1.011, 1.008, 1.006, 1.004, 1.002, 1.001, 1, 1, 1)'
const SOFT = 'cubic-bezier(.22, 1, .36, 1)'
let springCss: string | undefined
const spring = () =>
  (springCss ??= typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)') ? SPRING : SOFT)

/** a logo hovered: it takes its own colour (a soft fade) and lifts a little on a spring; let go, it comes back */
export function brandHover(svg: SVGSVGElement, colour: string | null, reduced: () => boolean) {
  return (on: boolean) => {
    const s = svg.style
    s.transition = `color .3s ${SOFT}, translate .5s ${spring()}`
    if (colour) s.color = on ? colour : ''
    s.translate = on && !reduced() ? '0 -6%' : ''
  }
}
