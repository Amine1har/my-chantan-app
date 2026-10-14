import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FooterLink {
  label: string
  href: string
}

interface FooterColumn {
  title: string
  links: FooterLink[]
}

interface Props {
  brand?: ReactNode
  description?: string
  columns?: FooterColumn[]
  copyright?: string
  className?: string
}

export function Footer({
  brand = "Brand",
  description,
  columns = [],
  copyright,
  className,
}: Props) {
  const year = new Date().getFullYear()
  const copy = copyright || `© ${year} ${typeof brand === "string" ? brand : ""}. All rights reserved.`

  return (
    <footer className={cn("w-full border-t border-border bg-background", className)}>
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="text-lg font-semibold text-foreground">{brand}</div>
            {description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
            )}
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-medium text-foreground mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground">
          {copy}
        </div>
      </div>
    </footer>
  )
}

export default Footer
