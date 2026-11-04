// the set's list and its groups' chunks, made by vite.config.ts (the `groups` plugin)
declare module 'virtual:ikoons-index' {
  import type { Icon } from '@lib/core/types'
  /** each group's drawn icons, by name, in the catalog's order */
  export const index: { id: string; title: string; names: string[] }[]
  /** a group's components: its own chunk */
  export const loaders: Record<string, () => Promise<{ default: Icon[] }>>
}
declare module 'virtual:ikoons-hero' {
  /** a few hundred drawings picked at random, each its bare SVG markup in currentColor on the 24 grid */
  const markup: string[]
  export default markup
}
