import type { DrawnNode, Icon } from '@lib/core/types'
import type { Look } from './settings'

// What the copy and download buttons make: the drawing as it is at rest, in the look chosen on the page — an SVG to
// paste into code or a design tool, a PNG at twice the size (sharp on a retina screen), a React line.

const INK = '#eaeae9' // the page's text: what "current" is in a PNG, which has no text colour around it
const kebab = (k: string) => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
const num = (n: number) => +n.toFixed(3)
const esc = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function attrs(a: Readonly<Record<string, string | number>>, stroke: number, colour: string) {
  let out = ''
  for (const [k, v] of Object.entries(a)) {
    if (k === 'data-part') continue
    if (k === '$sw') out += ` stroke-width="${num(stroke * Number(v))}"`
    else out += ` ${kebab(k)}="${esc(v === 'currentColor' ? colour : v)}"`
  }
  return out
}

function nodes(ns: readonly DrawnNode[], stroke: number, colour: string, pad: string): string {
  return ns
    .filter(([, a]) => !String(a['data-part'] ?? '').startsWith('fx-')) // effects only show while it moves
    .map(([tag, a, kids]) => {
      const own = attrs(a, stroke, colour)
      // a part's group with nothing of its own left (its name is the component's business) is just its shapes
      if (tag === 'g' && !own && kids?.length) return nodes(kids, stroke, colour, pad)
      return kids?.length
        ? `${pad}<${tag}${own}>\n${nodes(kids, stroke, colour, pad + '  ')}\n${pad}</${tag}>`
        : `${pad}<${tag}${own} />`
    })
    .join('\n')
}

/** the icon as SVG markup, in the look's weight, line width, size and colour */
export function svgOf(icon: Icon, look: Look, { colour = look.colour === 'current' ? 'currentColor' : look.colour } = {}): string {
  const d = icon.data[look.weight] ?? icon.data.filled ?? icon.data.outline!
  const { $sw = 1, ...layer } = d.a as Record<string, string | number>
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${look.size}" height="${look.size}" viewBox="0 0 24 24"${attrs({ ...layer, $sw }, look.stroke, colour)}>`,
    nodes(d.n, look.stroke, colour, '  '),
    '</svg>',
  ].join('\n')
}

/** the icon as a PNG, twice the look's size */
export async function pngOf(icon: Icon, look: Look): Promise<Blob> {
  const svg = svgOf(icon, look, { colour: look.colour === 'current' ? INK : look.colour })
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const px = look.size * 2
  const canvas = Object.assign(document.createElement('canvas'), { width: px, height: px })
  canvas.getContext('2d')!.drawImage(img, 0, 0, px, px)
  return new Promise((done, fail) => canvas.toBlob(b => (b ? done(b) : fail(new Error('no PNG'))), 'image/png'))
}

/** the React line for it, with only the props that differ from the set's defaults */
export function jsxOf(icon: Icon, look: Look): string {
  const name = icon.displayName ?? icon.data.name
  const props = [
    `size={${look.size}}`, // (its own default is 1em: as big as the text beside it)
    look.weight !== 'filled' && `weight="${look.weight}"`,
    look.stroke !== 2 && `strokeWidth={${look.stroke}}`,
    look.colour !== 'current' && `color="${look.colour}"`,
    look.motion !== 'hover' && `animate=${look.motion === 'off' ? '{false}' : `"${look.motion}"`}`,
  ].filter(Boolean)
  return `import { ${name} } from 'ikoons'\n\n<${name}${props.length ? ' ' + props.join(' ') : ''} />`
}

export const copyText = (s: string) => navigator.clipboard.writeText(s)

/** copies a PNG — the blob's promise goes in as is, so Safari still counts it as the click's */
export const copyPng = (blob: Promise<Blob>) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])

export function download(name: string, data: Blob | string, type = 'image/svg+xml') {
  const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type }) : data)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
