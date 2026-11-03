// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DrawingError, normalise, parseXml, partName, toSvg } from '../svg.ts'
import { formatPath, parsePath, subpaths } from '../../packages/icons/src/motion/path.ts'

const figma = (body: string, extra = '') =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"${extra}>\n${body}\n</svg>`
const read = (body: string, extra = '') => normalise(figma(body, extra), { icon: 'bell', file: 'icons/outline/bell.svg' })

describe('reading XML', () => {
  it('reads elements, attributes, entities and comments, and skips declarations', () => {
    const { root, comments } = parseXml(`<?xml version="1.0"?><!DOCTYPE svg><svg a='1' b="&amp;&#65;"><!-- hi --><g><path d="M0 0"/></g></svg>`)
    expect(root.tag).toBe('svg')
    expect(root.attrs).toEqual({ a: '1', b: '&A' })
    expect(root.children[0].children[0]).toEqual({ tag: 'path', attrs: { d: 'M0 0' }, children: [] })
    expect(comments).toEqual(['hi'])
  })
  it('says what is wrong with broken markup', () => {
    expect(() => parseXml('<svg><g></svg>')).toThrow(DrawingError)
    expect(() => parseXml('<svg><path d="M0 0"')).toThrow(/unclosed/)
  })
})

describe('path data', () => {
  it('reads every command, repeated numbers and packed arc flags', () => {
    expect(parsePath('M1 2 3 4L5,6h1v-1.5.5zm1 1a1 1 0 011 1')).toEqual([
      { c: 'M', a: [1, 2] }, { c: 'L', a: [3, 4] }, { c: 'L', a: [5, 6] }, { c: 'h', a: [1] }, { c: 'v', a: [-1.5] },
      { c: 'v', a: [0.5] }, { c: 'z', a: [] }, { c: 'm', a: [1, 1] }, { c: 'a', a: [1, 1, 0, 0, 1, 1, 1] },
    ])
  })
  it('writes it back short and unambiguous', () => {
    expect(formatPath(parsePath('M 1.23456 -2 L 3 -4.00001'))).toBe('M1.235-2L3-4')
  })
  it('cuts it into subpaths that each start with an absolute move', () => {
    const subs = subpaths(parsePath('M2 2h4m-4 2h4ZM10 10l1 1'))
    expect(subs.map(s => formatPath(s))).toEqual(['M2 2h4', 'M2 4h4Z', 'M10 10l1 1'])
  })
})

describe('a drawing', () => {
  it('turns any colour into currentColor and moves what the shapes share onto the layer', () => {
    const d = read('<path d="M4 6.5h16" stroke="#EAEAE9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
    expect(d.layer).toEqual({ fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', $sw: 1 })
    expect(d.nodes).toEqual([['path', { d: 'M4 6.5h16' }]])
  })
  it('keeps a line width as its share of the 2-unit line where it differs', () => {
    const d = read('<path d="M1 1h2" stroke="black" stroke-width="2"/><path d="M1 5h2" stroke="black" stroke-width="2"/><path d="M1 9h2" stroke="black" stroke-width="1.5"/>')
    expect(d.layer.$sw).toBe(1)
    expect(d.nodes[2]).toEqual(['path', { d: 'M1 9h2', $sw: 0.75 }])
  })
  it('makes named layers parts (Figma ids, with its _2 for repeats), and leaves unnamed ones alone', () => {
    const d = read('<path id="ray" d="M1 1h1" stroke="white" stroke-width="2"/><path id="ray_2" d="M1 3h1" stroke="white" stroke-width="2"/><path id="Vector 3" d="M1 5h1" stroke="white" stroke-width="2"/><g id="Clapper"><circle cx="12" cy="20" r="1" fill="white"/></g>')
    expect([...d.parts]).toEqual([['ray', 2], ['clapper', 1]])
    expect(d.nodes[0]).toEqual(['g', { 'data-part': 'ray' }, [['path', { d: 'M1 1h1' }]]])
    expect(d.nodes[2]).toEqual(['path', { d: 'M1 5h1' }])
    expect(d.nodes[3][1]).toEqual({ 'data-part': 'clapper' })
  })
  it('hides fx- parts at rest (effects that only show while the icon moves)', () => {
    const d = read('<path d="M1 1h4" stroke="white" stroke-width="2"/><path id="fx-glint" d="M1 3h1" stroke="white" stroke-width="2"/>')
    expect(d.nodes[1][1]).toEqual({ 'data-part': 'fx-glint', opacity: 0 })
  })
  it('splits a stroked path with several lines into one path per line, but never a filled one', () => {
    const lines = read('<path d="M6 6l12 12M18 6L6 18" stroke="white" stroke-width="2"/>')
    expect(lines.nodes.map(n => n[1].d)).toEqual(['M6 6l12 12', 'M18 6L6 18'])
    const solid = read('<path d="M2 2h8v8H2ZM4 4h4v4H4Z" fill="white" fill-rule="evenodd"/>')
    expect(solid.nodes).toHaveLength(1)
    expect(solid.layer['fill-rule'] ?? solid.nodes[0][1]['fill-rule']).toBe('evenodd')
  })
  it('drops the frame clip Figma adds, and reads fill and stroke from the style attribute too', () => {
    const d = read('<g clip-path="url(#clip0_1_2)"><path d="M1 1h2" style="stroke: #000; stroke-width: 2"/></g><defs><clipPath id="clip0_1_2"><rect width="24" height="24" fill="white"/></clipPath></defs>')
    expect(d.nodes).toEqual([['path', { d: 'M1 1h2' }]])
  })
  it('rounds numbers to three places', () => {
    const d = read('<circle cx="12.00004" cy="11.12345" r="3" fill="white"/>')
    expect(d.nodes[0][1]).toMatchObject({ cx: 12, cy: 11.123 })
  })
  it('knows a placeholder by its mark or its comment', () => {
    expect(read('<path d="M1 1h2" stroke="white"/>', ' data-placeholder="true"').placeholder).toBe(true)
    expect(read('<!-- PLACEHOLDER: replace me --><path d="M1 1h2" stroke="white"/>').placeholder).toBe(true)
    expect(read('<path d="M1 1h2" stroke="white"/>').placeholder).toBe(false)
  })
  it('one colour written several ways is one colour', () => {
    expect(() => read('<path d="M1 1h2" stroke="black"/><path d="M1 3h2" fill="#000"/><path d="M1 5h2" stroke="rgb(0, 0, 0)"/>')).not.toThrow()
  })

  it.each([
    ['another frame size', figma('<path d="M1 1h2" stroke="white"/>').replace('0 0 24 24', '0 0 32 32'), /24 × 24/],
    ['two colours', figma('<path d="M1 1h2" stroke="white"/><path d="M1 3h2" stroke="red"/>'), /2 colours/],
    ['a gradient', figma('<path d="M1 1h2" fill="url(#g)"/><defs><linearGradient id="g"/></defs>'), /one colour/],
    ['a mask', figma('<g mask="url(#m)"><path d="M1 1h2" stroke="white"/></g>'), /mask/],
    ['text', figma('<text>A</text>'), /isn't something an icon can be made of/],
    ['a filled frame', figma('<rect width="24" height="24" fill="white"/><path d="M1 1h2" stroke="black"/>'), /frame has a fill/],
    ['nothing drawn', figma('<g/>'), /nothing is drawn/],
  ])('stops on %s, naming the file', (_, svg, message) => {
    expect(() => normalise(svg, { icon: 'bell', file: 'icons/outline/bell.svg' })).toThrow(message)
    expect(() => normalise(svg, { icon: 'bell', file: 'icons/outline/bell.svg' })).toThrow(/icons\/outline\/bell\.svg/)
  })

  it('writes itself back as SVG markup', () => {
    const svg = toSvg(read('<path d="M4 6.5h16" stroke="white" stroke-width="3"/>'), { size: 48, background: '#141414' })
    expect(svg).toContain('width="48"')
    expect(svg).toContain('stroke-width="3"')
    expect(svg).toContain('<rect width="24" height="24" rx="4" fill="#141414"/>')
  })
})

describe('part names', () => {
  it.each([
    ['clapper', 'clapper'], ['Clapper', 'clapper'], ['ray_12', 'ray'], ['link a', 'link-a'], ['fx-glint_3', 'fx-glint'],
    ['Vector', null], ['Vector_7', null], ['Rectangle 12', null], ['Union', null], ['bell', null], ['filled/bell', null],
  ])('%s → %s', (id, name) => expect(partName(id, 'bell')).toBe(name))
})
