import { useEffect, useState } from 'react'
import type { Animate, IconData, Weight } from '@lib/core/types'

/** how the page shows the icons — and how they're copied: one look for the grid, the plate and the exports */
export interface Look {
  weight: Weight
  /** line width on the 24 grid */
  stroke: number
  /** px */
  size: number
  /** a colour, or 'current' (the text's: currentColor in an SVG) */
  colour: string
  /** when they move */
  motion: 'hover' | 'press' | 'loop' | 'off'
}

export const DEFAULT: Look = { weight: 'outline', stroke: 2, size: 24, colour: 'current', motion: 'hover' }

const KEY = 'ikoons.look'
const load = (): Look => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Look> | null
    // (the colour control is gone, 2026-11-05: icons take the text's colour, whatever was saved)
    const look = { ...DEFAULT, ...(saved ?? {}), colour: 'current' }
    // (animation is only on or off now: on is hover; the sizes come in steps)
    if (look.motion !== 'off') look.motion = 'hover'
    if (![16, 20, 24, 28, 32, 40, 48, 64, 96].includes(look.size)) look.size = 24
    if (![1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3].includes(look.stroke)) look.stroke = 2
    return look
  } catch {
    return DEFAULT
  }
}

/** the look, remembered in this browser (a convenience: it works the same without) */
export function useLook() {
  const [look, setLook] = useState<Look>(load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(look)) } catch { /* private window: it just isn't remembered */ }
  }, [look])
  const set = <K extends keyof Look>(k: K) => (v: Look[K]) => setLook(l => ({ ...l, [k]: v }))
  return [look, set, () => setLook(DEFAULT)] as const
}

/** an icon's `animate` for a look: a loader keeps going unless motion is off */
export const animateOf = (data: IconData, motion: Look['motion']): Animate =>
  motion === 'off' ? false : motion === 'loop' || data.loop ? 'loop' : motion
