import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  primary?: { label: string; href: string }
  secondary?: { label: string; href: string }
  variant?: "solid" | "subtle"
  className?: string
}

export function CTA({ title, subtitle, primary, secondary, variant = "solid", className }: Props) {
  const isSolid = variant === "solid"
  return (
    <section
      className={cn(
        "w-full py-20",
        isSolid ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        className
      )}
    >
      <div className="container max-w-3xl text-center space-y-6">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>
        {subtitle && (
          <p className={cn("text-lg leading-relaxed", isSolid ? "opacity-90" : "text-muted-foreground")}>
            {subtitle}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {primary && (
            <a
              href={primary.href}
              className={cn(
                "inline-flex items-center justify-center px-6 py-3 rounded-md font-medium transition-opacity",
                isSolid
                  ? "bg-background text-foreground hover:opacity-90"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {primary.label}
            </a>
          )}
          {secondary && (
            <a
              href={secondary.href}
              className={cn(
                "inline-flex items-center justify-center px-6 py-3 rounded-md font-medium border transition-colors",
                isSolid
                  ? "border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                  : "border-border text-foreground hover:bg-background"
              )}
            >
              {secondary.label}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

export default CTA
