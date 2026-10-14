import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface Feature {
  icon?: ReactNode
  title: string
  description: string
}

interface Props {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  features: Feature[]
  columns?: 2 | 3 | 4
  className?: string
}

export function Features({
  eyebrow,
  title,
  subtitle,
  features,
  columns = 3,
  className,
}: Props) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  }[columns]

  return (
    <section className={cn("w-full py-20 bg-background", className)}>
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16 space-y-4">
          {eyebrow && (
            <div className="text-xs font-medium tracking-wide uppercase text-primary">{eyebrow}</div>
          )}
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-lg">{subtitle}</p>}
        </div>

        <div className={cn("grid grid-cols-1 gap-6", gridCols)}>
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card text-card-foreground p-6 hover:shadow-md transition-shadow"
            >
              {f.icon && (
                <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                  {f.icon}
                </div>
              )}
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
