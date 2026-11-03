import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'
import type { Motion } from '../motion/recipes.js'
import type { Transition } from '../motion/transitions.js'

/** `filled` is the set's default; `outline` is drawn with lines whose width you set (`strokeWidth`) */
export type Weight = 'filled' | 'outline'

/**
 * when an icon plays its motion: when its button (or link, tab… or the icon itself) is hovered or focused from the
 * keyboard, when it's pressed, on and on (`loop`, a spinner's default) — or never
 */
export type Animate = 'hover' | 'press' | 'loop' | false

/** a drawn element: [tag, React props, children] — `$sw` is its line width as a share of `strokeWidth` */
export type DrawnNode = readonly [tag: string, attrs: Readonly<Record<string, string | number>>, children?: readonly DrawnNode[]]

/** one weight of an icon: what its layer group carries for all of its shapes (`a`), and its shapes (`n`) */
export interface Drawing {
  readonly a: Readonly<Record<string, string | number>>
  readonly n: readonly DrawnNode[]
}

export interface IconData {
  readonly name: string
  readonly filled?: Drawing
  readonly outline?: Drawing
  /** what it does on hover / press / `cue` */
  readonly motion?: Motion
  /** its motion runs on and on by default (a spinner) */
  readonly loop?: boolean
  /** a logo: its own colour on hover (null: a one-colour mark that only lifts) */
  readonly brand?: string | null
  /** how it becomes another icon in a <Swap>, by that icon's name (the way back plays it in reverse) */
  readonly to?: Readonly<Record<string, Transition>>
  /** a stand-in drawing, not the real one yet */
  readonly placeholder?: boolean
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'children' | 'strokeWidth'> {
  /** a length for its box (a number is px); `1em` by default, so it's as big as the text beside it */
  size?: number | string
  /** `filled` (the default) or `outline`; changing it fills the icon in, or empties it, with its motion */
  weight?: Weight
  /** the width of an outline's lines on the 24-unit grid (2 by default, 1.17 px at 14 px) */
  strokeWidth?: number
  /** when it plays its motion (default `hover`; a spinner's is `loop`) */
  animate?: Animate
  /** plays the motion whenever this value changes (a new notification: `cue={count}`) */
  cue?: unknown
  /** a label for screen readers; without one the icon is decoration (`aria-hidden`) */
  title?: string
}

/** an icon component, with its drawing and motion on `data` */
export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>> & { readonly data: IconData }

/** how the icons follow the visitor's reduced-motion setting: `user` (the default) follows it */
export type ReducedMotion = 'user' | 'always' | 'never'
