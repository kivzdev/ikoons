import { useEffect, useState } from 'react'
import { index, loaders } from 'virtual:ikoons-index'
import type { Icon } from '@lib/core/types'

// Five thousand icons, and the page never loads them all at once: it knows every name from the start (the index),
// and a group's drawings arrive as one chunk when the group comes near the screen or a search finds something in it.

export const GROUPS = index
export const COUNT = index.reduce((n, g) => n + g.names.length, 0)
const groupOf = new Map(index.flatMap(g => g.names.map(n => [n, g.id] as const)))
const known = new Map<string, Icon>()
const loading = new Map<string, Promise<Icon[]>>()

/** a group's icons (its chunk is fetched once) */
export function loadGroup(id: string): Promise<Icon[]> {
  let p = loading.get(id)
  if (!p) {
    p = loaders[id]().then(m => {
      for (const i of m.default) known.set(i.data.name, i)
      return m.default
    })
    loading.set(id, p)
  }
  return p
}

/** an icon by name, fetching its group if it isn't in yet */
export async function loadIcon(name: string): Promise<Icon | undefined> {
  const g = groupOf.get(name)
  if (!g) return undefined
  await loadGroup(g)
  return known.get(name)
}

/** the icons asked for, by name, once they're in (the ones not in yet are missing from the map) */
export function useIcons(names: readonly string[]): ReadonlyMap<string, Icon> {
  const key = names.join(' ')
  const [, redraw] = useState(0)
  useEffect(() => {
    let live = true
    const missing = names.filter(n => !known.has(n))
    if (missing.length) void Promise.all(missing.map(loadIcon)).then(() => live && redraw(n => n + 1))
    return () => void (live = false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return known
}

/** a group's icons once `wanted` (it came near the screen), undefined until they're in */
export function useGroup(id: string, wanted: boolean): readonly Icon[] | undefined {
  const [icons, setIcons] = useState<readonly Icon[] | undefined>()
  useEffect(() => {
    if (!wanted || icons) return
    let live = true
    void loadGroup(id).then(i => live && setIcons(i))
    return () => void (live = false)
  }, [id, wanted, icons])
  return icons
}
