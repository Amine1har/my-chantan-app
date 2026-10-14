import { motion, useReducedMotion } from 'framer-motion'
import { type ReactNode } from 'react'

// Platform motion primitive: wrap a section's content in <MotionReveal>
// and mark grouped children (hero lines, cards, rows, tiles) as
// <MotionItem>. Choreography is baked in — 24px ease-out rise, 60ms
// stagger, fires once per viewport, honors prefers-reduced-motion.
// Style via className; do not rewrite the timings.
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } } }

export function MotionReveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  const wrap = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", delay, delayChildren: delay + 0.1, staggerChildren: 0.06 } },
  }
  return (
    <motion.div className={className} variants={wrap} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
      {children}
    </motion.div>
  )
}

export function MotionItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return <motion.div className={className} variants={item}>{children}</motion.div>
}