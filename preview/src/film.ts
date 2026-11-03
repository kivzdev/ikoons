// Dev only (main.tsx loads it under `npm run dev`): films a motion frame by frame, for checking its pacing the way
// kivz-design asks ("verify motion by stepping frames"). The icons' clock is taken over, so nothing moves in real
// time while it films; copies of the icon at each step are laid out in a strip over the page.
//
//   __film.icon('bell', { every: 0.06, n: 12 })      a row's icon playing its motion
//   __film.change('play → pause')                    a row of the Changes table, pressed (await it)
//   __film.clear() / __film.release()                take the strip away / give the clock back

import { playIcon } from '@kivzdev/icons'
import { setClock } from '@kivzdev/icons/motion'

let now = 0
let waiting: (() => void)[] = []
let taken = false
const take = () => {
  if (taken) return
  taken = true
  setClock({ now: () => now, request: tick => void waiting.push(tick) })
}
const step = (s: number) => {
  for (let i = 0; i < Math.round(s * 60); i++) {
    now += 1000 / 60
    const ticks = waiting
    waiting = []
    for (const t of ticks) t()
  }
}

const strip = () => {
  let el = document.getElementById('film')
  if (!el) {
    el = document.createElement('div')
    el.id = 'film'
    el.style.cssText = 'position:fixed;inset:0 0 auto 0;z-index:99999;display:flex;flex-direction:column;gap:6px;max-height:100vh;overflow:auto;padding:8px;background:#141414;font:12px "Inter Variable",sans-serif;color:#565656'
    document.body.appendChild(el)
  }
  return el
}
const picture = (svg: SVGSVGElement) => {
  const c = svg.cloneNode(true) as SVGSVGElement
  c.setAttribute('width', '64')
  c.setAttribute('height', '64')
  c.setAttribute('color', '#eaeae9')
  c.removeAttribute('style')
  return `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(c))}`
}
const film = (label: string, svg: SVGSVGElement, { every = 0.05, n = 11, px = 76 } = {}) => {
  const row = document.createElement('div')
  row.style.cssText = 'display:flex;gap:2px;align-items:center'
  row.innerHTML = `<span style="flex:none;width:92px;color:#eaeae9">${label}</span>`
  for (let i = 0; i < n; i++) {
    if (i) step(every)
    const cell = document.createElement('div')
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;border:1px solid #1d1d1d;border-radius:4px'
    cell.innerHTML = `<img src="${picture(svg)}" width="${px}" height="${px}"><span style="font-size:10px">${(i * every).toFixed(2)}</span>`
    row.appendChild(cell)
  }
  strip().appendChild(row)
  step(3)
}

const rowOf = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.row')].find(b => b.querySelector('.row-title')?.textContent?.replace(' ★', '') === label)
const until = async (ok: () => boolean, ms = 1000) => {
  const t0 = performance.now()
  while (!ok() && performance.now() - t0 < ms) await new Promise(r => setTimeout(r, 10))
  return ok()
}
const layers = (svg: SVGSVGElement) => svg.querySelectorAll('[data-kz-layer]').length

const api = {
  step,
  icon(name: string, o?: Parameters<typeof film>[2]) {
    take()
    const svg = rowOf(name)?.querySelector('svg')
    if (!svg) return `${name}: no row`
    playIcon(svg)
    film(name, svg, o)
    return name
  },
  async change(label: string, o?: Parameters<typeof film>[2]) {
    take()
    const b = rowOf(label)
    const svg = b?.querySelector('svg')
    if (!b || !svg) return `${label}: no row`
    await until(() => layers(svg) === 1)
    b.click()
    if (!(await until(() => layers(svg) === 2))) return `${label}: didn't change`
    film(label + (b.getAttribute('aria-pressed') === 'true' ? '' : ' (back)'), svg, o)
    await until(() => layers(svg) === 1)
    return label
  },
  clear: () => document.getElementById('film')?.remove(),
  release() {
    setClock(null)
    taken = false
  },
}
;(window as unknown as { __film: typeof api }).__film = api
