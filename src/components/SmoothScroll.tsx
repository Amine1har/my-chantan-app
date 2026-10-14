import { useEffect, useRef, ReactNode } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface SmoothScrollProps {
  children: ReactNode
  /** Lenis smoothness — higher = more inertia. Default 1.2 (cinematic). */
  lerp?: number
  /** Disable smooth scroll entirely (for users who prefer no motion). */
  disabled?: boolean
}

/**
 * SmoothScroll — Lenis smooth scroll provider wrapped around the app.
 *
 * Wrap <App/> or <main/> in this component exactly once. It:
 *   1. Enables buttery Lenis smooth scrolling site-wide
 *   2. Connects Lenis to GSAP ScrollTrigger (so pinned sections work correctly)
 *   3. Respects `prefers-reduced-motion` and the `disabled` prop (instant fallback)
 *   4. Cleans up all listeners on unmount
 *
 * DO NOT nest multiple instances — one per page.
 */
export function SmoothScroll({ children, lerp = 0.12, disabled = false }: SmoothScrollProps) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (disabled || reducedMotion) return

    // CSS `scroll-behavior: smooth` fights Lenis: Lenis writes a small scroll
    // step every frame and CSS smooth re-animates EACH step, so the browser
    // never lands where Lenis put it (rubbery / laggy / stuck scrolling).
    // Lenis requires native scroll behavior while it drives the page; the
    // inline style beats any stylesheet rule and is restored on unmount.
    const prevScrollBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'

    const lenis = new Lenis({
      lerp,
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.5,
    })
    lenisRef.current = lenis
    // Expose the active Lenis instance so ScrollToTop can reset scroll THROUGH
    // Lenis on route change (a plain window.scrollTo is ignored while Lenis owns
    // the scroll). Cleared on unmount.
    ;(window as unknown as { __lenis?: Lenis }).__lenis = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const raf = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      document.documentElement.style.scrollBehavior = prevScrollBehavior
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenisRef.current = null
      const w = window as unknown as { __lenis?: Lenis }
      if (w.__lenis === lenis) w.__lenis = undefined
    }
  }, [lerp, disabled])

  return <>{children}</>
}

export default SmoothScroll
