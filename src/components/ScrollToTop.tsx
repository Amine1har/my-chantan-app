import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/**
 * ScrollToTop — resets the scroll position on every route change.
 *
 * React Router is a single-page app: client-side navigation PRESERVES the
 * current scroll position by default, so going from a long list page to a
 * detail page leaves the visitor scrolled half-way down. Mount this ONCE inside
 * <BrowserRouter> (above <Routes>) and every navigation lands at the top.
 *
 * It is "smart" in two ways:
 *  - Anchor links: if the URL has a #hash, it scrolls to that element instead of
 *    forcing the top, so in-page section links keep working.
 *  - Smooth-scroll aware: if SmoothScroll (Lenis) is active it resets THROUGH
 *    Lenis — a plain window.scrollTo is ignored while Lenis owns the scroll.
 *    Without Lenis it falls back to the native window scroll.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: unknown, o?: unknown) => void } }).__lenis

    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        if (lenis) lenis.scrollTo(el, { offset: 0 })
        else el.scrollIntoView({ behavior: "smooth" })
        return
      }
    }

    if (lenis) lenis.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}

export default ScrollToTop
