// @vitest-environment node
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Bell, Heart, IconProvider, KivzLogo, Play, Spinner, Star, Swap, Trash } from '../src/index.js'

const html = (el: ReactElement) => renderToString(el)

describe('on a server', () => {
  it('renders the drawing as plain SVG, 1em by default, as decoration', () => {
    const s = html(<Heart />)
    expect(s).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" width="1em" height="1em" overflow="visible" aria-hidden="true"/)
    expect(s).toContain('data-kz-icon="heart"')
    expect(s).toContain('fill="currentColor"')
    expect(s.match(/data-kz-layer/g)).toHaveLength(1)
  })

  it('is filled unless asked for outline, and draws lines at the stroke width asked for', () => {
    expect(html(<Bell />)).toContain('M10 19.5a2 2 0 0 0 4 0Z')
    const outline = html(<Bell weight="outline" strokeWidth={1.5} />)
    expect(outline).toContain('M10 19.5a2 2 0 0 0 4 0"')
    expect(outline).toContain('stroke-width="1.5"')
    expect(outline).toContain('fill="none"')
  })

  it('keeps a part’s own line width as its share of the stroke width', () => {
    // the star's glints are drawn at 1.5 against the 2-unit line
    expect(html(<Star weight="outline" strokeWidth={3} />)).toContain('stroke-width="2.25"')
  })

  it('takes a size, a colour and any SVG prop', () => {
    const s = html(<Trash size={14} color="#fdd900" className="x" style={{ opacity: 0.5 }} />)
    expect(s).toContain('width="14" height="14"')
    expect(s).toContain('color="#fdd900"')
    expect(s).toContain('class="x"')
    expect(s).toContain('style="opacity:0.5"')
  })

  it('is an image with a name when it has a title', () => {
    const s = html(<Bell title="Notifications" />)
    expect(s).toContain('role="img"')
    expect(s).not.toContain('aria-hidden')
    expect(s).toContain('<title>Notifications</title>')
  })

  it('takes its defaults from a provider, its own props winning', () => {
    const s = html(<IconProvider size={20} weight="outline"><Bell /><Bell weight="filled" /></IconProvider>)
    expect(s.match(/width="20"/g)).toHaveLength(2)
    expect(s).toContain('M10 19.5a2 2 0 0 0 4 0"')
    expect(s).toContain('M10 19.5a2 2 0 0 0 4 0Z')
  })

  it('falls back to the weight that is drawn (a logo has only its filled one)', () => {
    expect(html(<KivzLogo weight="outline" />)).toContain('data-kz-icon="kivz-logo"')
  })

  it('renders a Swap as the icon it shows', () => {
    expect(html(<Swap icon={Play} />)).toContain('data-kz-icon="play"')
  })

  it('carries its drawing and motion on the component', () => {
    expect(Spinner.data.loop).toBe(true)
    expect(KivzLogo.data.brand).toBe('#fdd900')
    expect(Heart.data.placeholder).toBe(true)
    expect(Play.data.to?.pause).toBeTypeOf('function')
    expect(Heart.displayName).toBe('Heart')
  })
})
