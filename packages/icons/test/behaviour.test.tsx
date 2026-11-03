import { act, fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { createIcon, Heart, IconProvider, KivzLogo, playIcon, Spinner, Swap, type Icon } from '../src/index.js'
import { pop } from '../src/motion/recipes.js'
import { motion, time } from './setup.js'

// stand-in icons (a test DOM can't measure shapes, so these change by the default blur rather than a morph)
const icon = (name: string, d: string): Icon => createIcon(name, { filled: { a: { fill: 'currentColor' }, n: [['path', { d }]] } }, { motion: pop() })
const A = icon('a', 'M1 1h4v4H1Z')
const B = icon('b', 'M2 2h4v4H2Z')
const C = icon('c', 'M3 3h4v4H3Z')
const D = icon('d', 'M4 4h4v4H4Z')

const shown = (c: HTMLElement) => [...c.querySelectorAll('[data-kz-layer]')].map(l => l.querySelector('path')!.getAttribute('d'))
const step = (s: number) => act(() => time.step(s))

describe('changing from one icon to another', () => {
  it('blurs the old one out where it stands and the new one in, then keeps only the new', () => {
    const { container, rerender } = render(<Swap icon={A} />)
    expect(shown(container)).toEqual(['M1 1h4v4H1Z'])
    rerender(<Swap icon={B} />)
    expect(shown(container)).toEqual(['M1 1h4v4H1Z', 'M2 2h4v4H2Z'])
    step(0.1)
    const [from, to] = container.querySelectorAll('[data-kz-layer]')
    expect(from.getAttribute('filter')).toMatch(/^url\(#kz-blur-/)
    expect(Number(from.getAttribute('opacity'))).toBeLessThan(1)
    expect(Number(to.getAttribute('opacity'))).toBe(0)
    step(1)
    expect(shown(container)).toEqual(['M2 2h4v4H2Z'])
    expect(container.querySelector('[data-kz-layer]')!.hasAttribute('opacity')).toBe(false)
    expect(container.querySelector('filter')).toBeNull()
  })

  it('never cuts a change short: what’s asked for meanwhile waits, and only the last of it is gone to', () => {
    const { container, rerender } = render(<Swap icon={A} />)
    rerender(<Swap icon={B} />)
    step(0.2)
    rerender(<Swap icon={C} />)
    rerender(<Swap icon={D} />)
    expect(shown(container)).toEqual(['M1 1h4v4H1Z', 'M2 2h4v4H2Z'])
    step(0.5)
    // A → B finished, and it went straight on to D (C was never shown)
    expect(shown(container)).toEqual(['M2 2h4v4H2Z', 'M4 4h4v4H4Z'])
    step(1)
    expect(shown(container)).toEqual(['M4 4h4v4H4Z'])
  })

  it('going back to the one it’s leaving turns the change round where it is', () => {
    const { container, rerender } = render(<Swap icon={A} />)
    rerender(<Swap icon={B} />)
    step(0.3)
    rerender(<Swap icon={A} />)
    // it runs back from where it got to (0.3 s in), so it's home in about 0.3 s, not after a whole new change
    step(0.2)
    expect(shown(container)).toHaveLength(2)
    step(0.15)
    expect(shown(container)).toEqual(['M1 1h4v4H1Z'])
  })

  it('under reduced motion it only fades, quickly', () => {
    motion.reduce(true)
    const { container, rerender } = render(<Swap icon={A} />)
    rerender(<Swap icon={B} />)
    step(0.1)
    expect(container.querySelector('[data-kz-layer]')!.hasAttribute('filter')).toBe(false)
    step(0.2)
    expect(shown(container)).toEqual(['M2 2h4v4H2Z'])
  })
})

describe('changing weight', () => {
  it('fills the icon in from its middle, then keeps only the filled drawing', () => {
    const { container, rerender } = render(<Heart weight="outline" />)
    rerender(<Heart weight="filled" />)
    const layers = container.querySelectorAll('[data-kz-layer]')
    expect(layers).toHaveLength(2)
    step(0.1)
    expect(layers[1].getAttribute('transform')).toMatch(/scale\(0\.\d+/)
    step(2)
    expect(container.querySelectorAll('[data-kz-layer]')).toHaveLength(1)
    expect(container.querySelector('[data-kz-layer]')!.getAttribute('fill')).toBe('currentColor')
  })
})

describe('its motion', () => {
  const root = (c: HTMLElement) => c.querySelector('[data-kz-root]')!

  it('plays when its button is hovered, once, and leaves the drawing as it was', () => {
    const { container } = render(<button><A /></button>)
    fireEvent.pointerEnter(container.querySelector('button')!, { pointerType: 'mouse' })
    step(0.05)
    expect(root(container).getAttribute('transform')).toContain('scale(')
    // hovering again while it plays doesn't start it over
    fireEvent.pointerEnter(container.querySelector('button')!, { pointerType: 'mouse' })
    step(1)
    expect(root(container).hasAttribute('transform')).toBe(false)
  })

  it('plays on press instead, when asked', () => {
    const { container } = render(<button><A animate="press" /></button>)
    const button = container.querySelector('button')!
    fireEvent.pointerEnter(button, { pointerType: 'mouse' })
    step(0.05)
    expect(root(container).hasAttribute('transform')).toBe(false)
    fireEvent.pointerDown(button, { pointerType: 'mouse' })
    step(0.05)
    expect(root(container).getAttribute('transform')).toContain('scale(')
  })

  it('plays whenever its cue changes, and from outside React', () => {
    function Bell({ n }: { n: number }) {
      const ref = useRef<SVGSVGElement>(null)
      return <><A cue={n} ref={ref} /><button onClick={() => playIcon(ref.current)}>ring</button></>
    }
    const { container, rerender } = render(<Bell n={0} />)
    step(0.05)
    expect(root(container).hasAttribute('transform')).toBe(false)
    rerender(<Bell n={1} />)
    step(0.05)
    expect(root(container).getAttribute('transform')).toContain('scale(')
    step(1)
    fireEvent.click(container.querySelector('button')!)
    step(0.05)
    expect(root(container).getAttribute('transform')).toContain('scale(')
  })

  it('stays still under reduced motion, or when told to', () => {
    motion.reduce(true)
    const { container } = render(<button><A /></button>)
    fireEvent.pointerEnter(container.querySelector('button')!, { pointerType: 'mouse' })
    step(0.05)
    expect(root(container).hasAttribute('transform')).toBe(false)
    motion.reduce(false)
    const still = render(<IconProvider animate={false}><button><A /></button></IconProvider>)
    fireEvent.pointerEnter(still.container.querySelector('button')!, { pointerType: 'mouse' })
    step(0.05)
    expect(root(still.container).hasAttribute('transform')).toBe(false)
  })

  it('can be made to move regardless of the visitor’s setting (a showcase), or never', () => {
    motion.reduce(true)
    const { container } = render(<IconProvider reducedMotion="never"><button><A /></button></IconProvider>)
    fireEvent.pointerEnter(container.querySelector('button')!, { pointerType: 'mouse' })
    step(0.05)
    expect(root(container).getAttribute('transform')).toContain('scale(')
  })
})

describe('a spinner', () => {
  it('goes round on its own, and comes to rest on a whole turn when it’s stopped', () => {
    const { container, rerender } = render(<Spinner />)
    step(0.5)
    const r1 = /rotate\(([-\d.]+)\)/.exec(container.querySelector('[data-kz-root]')!.getAttribute('transform') ?? '')
    expect(Number(r1?.[1])).toBeGreaterThan(0)
    rerender(<Spinner animate={false} />)
    step(3)
    expect(container.querySelector('[data-kz-root]')!.hasAttribute('transform')).toBe(false)
  })

  it('only breathes under reduced motion', () => {
    motion.reduce(true)
    const { container } = render(<Spinner />)
    step(0.4)
    const root = container.querySelector('[data-kz-root]')!
    expect(root.hasAttribute('transform')).toBe(false)
    expect(Number(root.getAttribute('opacity'))).toBeLessThan(1)
  })
})

describe('a logo', () => {
  it('takes its own colour while hovered, and gives it back', () => {
    const { container } = render(<a href="#"><KivzLogo /></a>)
    const a = container.querySelector('a')!
    const svg = container.querySelector('svg')!
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    expect(svg.style.color).toBe('rgb(253, 217, 0)')
    fireEvent.pointerLeave(a, { pointerType: 'mouse' })
    expect(svg.style.color).toBe('')
  })
})
