// SVG path data, read and written. The build uses it to split a stroked path into its lines (so each can be drawn on its
// own); a morph uses it to take a shape apart into its outlines. No DOM: safe on a server and in the build.

/** one command as written (its letter keeps its case: lower = relative) and its numbers */
export interface Segment {
  c: string
  a: number[]
}

const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 }
const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y
const GAP = /[\s,]*/y

export function parsePath(d: string): Segment[] {
  const out: Segment[] = []
  let i = 0
  const skip = () => {
    GAP.lastIndex = i
    GAP.exec(d)
    i = GAP.lastIndex
  }
  const fail = (what: string): never => {
    throw new Error(`path data: ${what} at "${d.slice(Math.max(0, i - 8), i + 12)}"`)
  }
  const num = () => {
    skip()
    NUMBER.lastIndex = i
    const m = NUMBER.exec(d)
    if (!m) fail('expected a number')
    i = NUMBER.lastIndex
    return Number(m![0])
  }
  // an arc's two flags may be written without anything between them ("a1 1 0 011 1")
  const flag = () => {
    skip()
    const ch = d[i]
    if (ch !== '0' && ch !== '1') fail('expected an arc flag')
    i++
    return ch === '1' ? 1 : 0
  }
  let cmd = ''
  for (;;) {
    skip()
    if (i >= d.length) break
    const ch = d[i]
    if (/[a-zA-Z]/.test(ch)) {
      cmd = ch
      i++
    } else if (!cmd) fail('expected a command')
    const lower = cmd.toLowerCase()
    const k = ARGS[lower]
    if (k === undefined) fail(`unknown command "${cmd}"`)
    if (k === 0) {
      out.push({ c: cmd, a: [] })
      cmd = '' // (numbers can't follow a close without a command of their own)
      continue
    }
    const a: number[] = []
    for (let j = 0; j < k; j++) a.push(lower === 'a' && (j === 3 || j === 4) ? flag() : num())
    out.push({ c: cmd, a })
    // numbers that carry on after a move are lines
    if (lower === 'm') cmd = cmd === 'm' ? 'l' : 'L'
  }
  return out
}

const fmt = (n: number, digits: number) => {
  const s = String(+n.toFixed(digits))
  return s === '-0' ? '0' : s
}

/** writes path data back, numbers rounded to `digits` places, as short as it reads unambiguously */
export function formatPath(segs: readonly Segment[], digits = 3): string {
  let out = ''
  for (const s of segs) {
    out += s.c
    s.a.forEach((n, j) => {
      const v = fmt(n, digits)
      if (j > 0 && !v.startsWith('-')) out += ' '
      out += v
    })
  }
  return out
}

/** the path cut into its subpaths, each starting with an absolute move (the rest stays as written) */
export function subpaths(segs: readonly Segment[]): Segment[][] {
  const out: Segment[][] = []
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let cur: Segment[] | null = null
  for (const s of segs) {
    const lower = s.c.toLowerCase()
    const rel = s.c === lower
    const a = s.a
    if (lower === 'm') {
      x = rel ? x + a[0] : a[0]
      y = rel ? y + a[1] : a[1]
      sx = x
      sy = y
      cur = [{ c: 'M', a: [x, y] }]
      out.push(cur)
      continue
    }
    if (!cur) {
      // (a command right after a close starts a new subpath where the last one began)
      cur = [{ c: 'M', a: [x, y] }]
      out.push(cur)
    }
    cur.push({ c: s.c, a: [...a] })
    if (lower === 'z') {
      x = sx
      y = sy
      cur = null
    } else if (lower === 'h') x = rel ? x + a[0] : a[0]
    else if (lower === 'v') y = rel ? y + a[0] : a[0]
    else {
      x = rel ? x + a[a.length - 2] : a[a.length - 2]
      y = rel ? y + a[a.length - 1] : a[a.length - 1]
    }
  }
  return out
}

/** whether a subpath comes back round to its start (ends with a close) */
export const closed = (segs: readonly Segment[]) => segs.length > 0 && segs[segs.length - 1].c.toLowerCase() === 'z'
