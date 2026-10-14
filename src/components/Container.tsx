import { forwardRef, type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Max-width preset. Defaults to "lg" (max-w-7xl). */
  size?: "sm" | "md" | "lg" | "xl" | "full"
}

/**
 * Container — standardized max-width + horizontal padding wrapper.
 *
 * Use this instead of inventing <div className="max-w-7xl mx-auto px-X">.
 * Keeps content width consistent across the project.
 *
 * Usage:
 *   <Section>
 *     <Container size="lg">
 *       <h2>Headline</h2>
 *       ...
 *     </Container>
 *   </Section>
 */
const sizeClasses = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  xl: "max-w-screen-2xl",
  full: "max-w-none",
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ size = "lg", className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(sizeClasses[size], "mx-auto px-6 md:px-12", className)}
      {...props}
    >
      {children}
    </div>
  ),
)
Container.displayName = "Container"
