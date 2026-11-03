'use client'
import {
  createElement, forwardRef, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef,
  type ForwardedRef, type ReactElement,
} from 'react'
import { IconContext } from './context.js'
import { keyOf, Stack, type Look } from './stack.js'
import { bind, brandHover } from './trigger.js'
import type { Drawing, DrawnNode, Icon, IconData, IconProps, ReducedMotion, Weight } from './types.js'

// (effects that must run before the browser paints — on a server there's no paint, and no warning either)
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect

const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const round = (v: number) => +v.toFixed(3)

/** every icon on the page, for `playIcon` */
const stacks = new WeakMap<Element, Stack>()

/** plays an icon's motion from outside React (or from a handler with a ref to it) */
export function playIcon(svg: SVGSVGElement | null | undefined) {
  if (svg) stacks.get(svg)?.poke()
}

function node([tag, attrs, kids]: DrawnNode, key: number, sw: number): ReactElement {
  const { $sw, ...a } = attrs as Record<string, string | number>
  const props: Record<string, unknown> = { key, ...a }
  if ($sw !== undefined) props.strokeWidth = round(sw * Number($sw))
  return createElement(tag, props, kids?.map((k, i) => node(k, i, sw)))
}

const drawingOf = (look: Look): Drawing => (look.data[look.weight] ?? look.data.filled ?? look.data.outline)!

function Layer({ look, sw, stack }: { look: Look; sw: number; stack: Stack }) {
  const key = keyOf(look)
  const ref = useCallback((el: SVGGElement | null) => stack.ref(key, el), [stack, key])
  const d = drawingOf(look)
  const shapes = useMemo(() => d.n.map((n, i) => node(n, i, sw)), [d, sw])
  const { $sw = 1, ...a } = d.a as Record<string, string | number>
  return (
    <g data-kz-layer="" ref={ref} {...a} strokeWidth={round(sw * Number($sw))}>
      <g data-kz-root="">{shapes}</g>
    </g>
  )
}

function useStack(look: Look, reduced: ReducedMotion): Stack {
  const ref = useRef<Stack | null>(null)
  ref.current ??= new Stack(look)
  const stack = ref.current
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  stack.onChange = redraw
  stack.reduced = () => reduced === 'always' || (reduced !== 'never' && prefersReduced())
  useIso(() => () => stack.dispose(), [stack])
  useIso(() => stack.request(look), [stack, look])
  useIso(() => stack.mounted())
  return stack
}

const assign = <T,>(ref: ForwardedRef<T>, value: T | null) => {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

const weightOf = (data: IconData, asked: Weight): Weight => (data[asked] ? asked : data.filled ? 'filled' : 'outline')

const Svg = forwardRef<SVGSVGElement, IconProps & { data: IconData }>(function KivzIcon(props, ref) {
  const d = useContext(IconContext)
  const {
    data,
    size = d.size ?? '1em',
    weight: asked = d.weight ?? 'filled',
    strokeWidth = d.strokeWidth ?? 2,
    animate = data.loop ? 'loop' : (d.animate ?? 'hover'),
    cue,
    title,
    ...rest
  } = props
  const weight = weightOf(data, asked)
  const look = useMemo<Look>(() => ({ data, weight }), [data, weight])
  const stack = useStack(look, d.reducedMotion ?? 'user')
  const svg = useRef<SVGSVGElement | null>(null)
  const setSvg = useCallback((el: SVGSVGElement | null) => {
    svg.current = el
    stack.svg = el
    if (el) stacks.set(el, stack)
    assign(ref, el)
  }, [stack, ref])

  // what sets it off: hover or press on its button (a logo's hover is a state: its colour, a little lift)
  useEffect(() => {
    const el = svg.current
    if (!el || animate === false || animate === 'loop') return
    const logo = data.brand !== undefined
    return bind(el, {
      mode: animate,
      play: () => (logo && animate === 'hover' ? undefined : stack.poke()),
      hover: logo ? brandHover(el, data.brand ?? null, stack.reduced) : undefined,
    })
  }, [animate, data, stack])
  useEffect(() => stack.loop(animate === 'loop'), [animate, stack])
  const cued = useRef(cue)
  useEffect(() => {
    if (Object.is(cued.current, cue)) return
    cued.current = cue
    stack.poke()
  }, [cue, stack])

  const labelled = Boolean(title || rest['aria-label'] || rest['aria-labelledby'])
  return (
    <svg
      ref={setSvg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      overflow="visible"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      data-kz-icon={data.name}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {stack.layers().map(l => <Layer key={keyOf(l)} look={l} sw={strokeWidth} stack={stack} />)}
    </svg>
  )
})

const pascal = (name: string) => name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')

/** makes an icon component from a drawing (what the build does for every icon in the set; yours can too) */
export function createIcon(name: string, drawings: { filled?: Drawing; outline?: Drawing }, more: Omit<IconData, 'name' | 'filled' | 'outline'> = {}): Icon {
  const data: IconData = { name, ...drawings, ...more }
  const C = forwardRef<SVGSVGElement, IconProps>((props, ref) => <Svg {...props} data={data} ref={ref} />)
  C.displayName = pascal(name)
  return Object.assign(C, { data })
}

export interface SwapProps extends IconProps {
  /** the icon to show; changing it changes the drawing with the pair's own transition, or a blur in place */
  icon: Icon
}

/**
 * one place that shows one icon at a time and goes from one to the next: `<Swap icon={playing ? Pause : Play} />`.
 * A change under way is never cut short: what's asked for meanwhile waits, then the last of it is gone to.
 */
export const Swap = forwardRef<SVGSVGElement, SwapProps>(function Swap({ icon, ...props }, ref) {
  return <Svg {...props} data={icon.data} ref={ref} />
})
