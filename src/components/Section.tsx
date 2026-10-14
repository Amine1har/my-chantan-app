import { forwardRef, type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Vertical rhythm preset. Defaults to "lg" (py-20 desktop, py-12 mobile). */
  size?: "sm" | "md" | "lg" | "xl"
  /** Background variant matching shadcn semantic tokens. */
  background?: "default" | "card" | "muted" | "accent"
}

/**
 * Section — standardized vertical-rhythm wrapper for landing-page sections.
 *
 * Use this instead of inventing <section className="py-X md:py-Y">. Keeps
 * spacing consistent across HeroSection, MenuSection, AboutSection, etc.
 *
 * Usage:
 *   <Section id="features" size="lg" background="muted">
 *     <Container>...content...</Container>
 *   </Section>
 */
const sizeClasses = {
  sm: "py-8 md:py-12",
  md: "py-12 md:py-16",
  lg: "py-16 md:py-24",
  xl: "py-20 md:py-32",
}
const bgClasses = {
  default: "bg-background",
  card: "bg-card",
  muted: "bg-muted/30",
  accent: "bg-accent/30",
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  ({ size = "lg", background = "default", className, children, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(sizeClasses[size], bgClasses[background], className)}
      {...props}
    >
      {children}
    </section>
  ),
)
Section.displayName = "Section"
