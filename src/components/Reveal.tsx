import { useEffect, useRef, useState, type ReactNode } from "react"

/**
 * Reveal — fades + slides its children in when they scroll into view.
 * Premium-feel scroll animation with zero config. Respects reduced-motion.
 *
 *   <Reveal><FeatureCard /></Reveal>
 *   <Reveal delay={120} as="section">…</Reveal>
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: keyof JSX.IntrinsicElements
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Respect users who prefer no motion — show immediately.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const Comp = Tag as any
  return (
    <Comp
      ref={ref as any}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Comp>
  )
}

export default Reveal
