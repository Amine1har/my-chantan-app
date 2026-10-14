import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface Testimonial {
  quote: string
  author: string
  role?: string
  avatar?: string
}

interface Props {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  items: Testimonial[]
  className?: string
}

export function Testimonials({ eyebrow, title, subtitle, items, className }: Props) {
  return (
    <section className={cn("w-full py-20", className)}>
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-16 space-y-4">
          {eyebrow && (
            <div className="text-xs font-medium tracking-wide uppercase text-primary">{eyebrow}</div>
          )}
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-lg">{subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <figure
              key={i}
              className="rounded-xl border border-border bg-card text-card-foreground p-6"
            >
              <blockquote className="text-base leading-relaxed">
                <span className="text-3xl text-muted-foreground/50 leading-none align-top me-1">“</span>
                {t.quote}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {t.avatar && (
                  <img
                    src={t.avatar}
                    alt={t.author}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.author}</div>
                  {t.role && <div className="text-xs text-muted-foreground">{t.role}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials
