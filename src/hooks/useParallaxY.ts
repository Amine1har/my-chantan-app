import { useEffect, RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface UseParallaxYOptions {
  /** How far to translate at full scroll — default -20 (gentle). Use -50 for dramatic. */
  amount?: number
  /** Scroll trigger range — default section self. */
  start?: string
  end?: string
  /** Disable on mobile (default false — parallax is cheap enough for phones). */
  disableOnMobile?: boolean
}

/**
 * useParallaxY — tie an element's vertical position to scroll progress.
 *
 * Simplest possible parallax: as the section scrolls past the viewport,
 * the target translates Y by `amount` percent. Use on hero images, section
 * backgrounds, decorative layers.
 *
 * The canonical wrapper — LLMs should call this hook instead of writing
 * raw GSAP + ScrollTrigger code.
 *
 * Respects `prefers-reduced-motion` — returns a no-op.
 *
 * Usage:
 *   const bgRef = useRef<HTMLDivElement>(null)
 *   useParallaxY(bgRef, { amount: -30 })
 *   return (
 *     <section className="relative">
 *       <div ref={bgRef} className="absolute inset-0">
 *         <SafeImage src="" alt="..." className="w-full h-full object-cover" />
 *       </div>
 *       <div className="relative z-10">content</div>
 *     </section>
 *   )
 */
export function useParallaxY(
  ref: RefObject<HTMLElement>,
  options: UseParallaxYOptions = {}
): void {
  const {
    amount = -20,
    start = 'top bottom',
    end = 'bottom top',
    disableOnMobile = false,
  } = options

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    if (disableOnMobile && window.innerWidth < 768) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { yPercent: 0 },
        {
          yPercent: amount,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start,
            end,
            scrub: true,
          },
        }
      )
    }, el)

    return () => ctx.revert()
  }, [ref, amount, start, end, disableOnMobile])
}

export default useParallaxY
