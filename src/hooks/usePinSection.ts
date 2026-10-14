import { useEffect, RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface UsePinSectionOptions {
  /** ScrollTrigger start (default 'top top'). */
  start?: string
  /** ScrollTrigger end (default '+=100%' — one viewport of pinning). */
  end?: string
  /** Scrub value — `true` = tie animation to scroll, number = smoothing lerp. */
  scrub?: boolean | number
  /** Pin the trigger itself (default true). */
  pin?: boolean
  /** Additional timeline — pass a function that gets a gsap.timeline and the pinned element. */
  timeline?: (tl: gsap.core.Timeline, el: HTMLElement) => void
  /** Disable on mobile (<768px). Default true (cinematic pinning is rough on mobile). */
  disableOnMobile?: boolean
}

/**
 * usePinSection — cinematic pinned scroll section.
 *
 * Pins the element as the user scrolls through it, and optionally runs a
 * GSAP timeline tied to scroll progress. Use for hero sections, feature
 * reveals, or any "camera stays here while content animates" effect.
 *
 * The canonical wrapper — LLMs should call this hook instead of writing
 * raw GSAP ScrollTrigger code (which they frequently get wrong).
 *
 * Respects `prefers-reduced-motion` — falls back to static section.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null)
 *   usePinSection(ref, {
 *     end: '+=200%',
 *     timeline: (tl, el) => {
 *       tl.to(el.querySelector('h1'), { scale: 0.6, opacity: 0.3 })
 *         .to(el.querySelector('img'), { yPercent: -30 }, 0)
 *     }
 *   })
 *   return <section ref={ref}>...</section>
 */
export function usePinSection(
  ref: RefObject<HTMLElement>,
  options: UsePinSectionOptions = {}
): void {
  const {
    start = 'top top',
    end = '+=100%',
    scrub = true,
    pin = true,
    timeline,
    disableOnMobile = true,
  } = options

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    if (disableOnMobile && window.innerWidth < 768) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start,
          end,
          scrub,
          pin,
          anticipatePin: 1,
        },
      })
      if (timeline) {
        timeline(tl, el)
      }
    }, el)

    return () => ctx.revert()
  }, [ref, start, end, scrub, pin, timeline, disableOnMobile])
}

export default usePinSection
