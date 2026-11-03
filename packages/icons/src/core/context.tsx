'use client'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Animate, ReducedMotion, Weight } from './types.js'

/** defaults for every icon inside an <IconProvider>; an icon's own props win */
export interface IconDefaults {
  size?: number | string
  weight?: Weight
  strokeWidth?: number
  animate?: Animate
  reducedMotion?: ReducedMotion
}

export const IconContext = createContext<IconDefaults>({})

export function IconProvider({ children, ...value }: IconDefaults & { children?: ReactNode }) {
  const parent = useContext(IconContext)
  const { size, weight, strokeWidth, animate, reducedMotion } = value
  const merged = useMemo(() => {
    const own = Object.fromEntries(Object.entries({ size, weight, strokeWidth, animate, reducedMotion }).filter(([, v]) => v !== undefined))
    return { ...parent, ...own } as IconDefaults
  }, [parent, size, weight, strokeWidth, animate, reducedMotion])
  return <IconContext.Provider value={merged}>{children}</IconContext.Provider>
}
