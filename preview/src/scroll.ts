import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

// The page scrolls on a short glide (Kivz: "it should flow"): a wheel's steps and a trackpad's flicks are eased into one
// movement (Lenis, MIT), and a jump the page makes itself — to the search, to a section of the docs — travels on the
// site's smooth curve instead of cutting. A box that scrolls by itself (the categories) scrolls by itself; a rail taller
// than the window too. Under reduced motion: the browser's own scrolling, no glide.

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const lenis = reduced ? null : new Lenis({ autoRaf: true, lerp: 0.12, allowNestedScroll: true })
if (import.meta.hot) import.meta.hot.dispose(() => lenis?.destroy())

/** SwiftUI's .smooth: a critically damped spring — quick away, landing without passing */
const smooth = (t: number) => (1 - (1 + 8 * t) * Math.exp(-8 * t)) / (1 - 9 * Math.exp(-8))

/** the page to `y`: gliding there (0.5–0.95 s, by how far), or at once */
export function scrollToY(y: number, glide = true) {
  if (!lenis) return void scrollTo({ top: y })
  if (!glide) return lenis.scrollTo(y, { immediate: true, force: true })
  lenis.scrollTo(y, { duration: Math.min(0.95, 0.5 + Math.abs(y - scrollY) / 4000), easing: smooth, force: true })
}

/**
 * while the page moves under a pointer that's still, the icons passing under it don't light up and play one after
 * another; the moment the pointer moves (to press one), they answer again
 */
let still = 0
const free = () => {
  clearTimeout(still)
  document.documentElement.removeAttribute('data-scrolling')
}
addEventListener('scroll', () => {
  document.documentElement.toggleAttribute('data-scrolling', true)
  clearTimeout(still)
  still = window.setTimeout(free, 140)
}, { passive: true })
addEventListener('pointermove', () => document.documentElement.hasAttribute('data-scrolling') && free(), { passive: true })
