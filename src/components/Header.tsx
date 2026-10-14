import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
}

interface Props {
  brand?: ReactNode
  brandHref?: string
  nav?: NavItem[]
  cta?: ReactNode
  className?: string
  sticky?: boolean
}

export function Header({
  brand = "Brand",
  brandHref = "/",
  nav = [],
  cta,
  className,
  sticky = true,
}: Props) {
  return (
    <header
      className={cn(
        "w-full z-30 border-b border-border bg-background/80 backdrop-blur-md",
        sticky && "sticky top-0",
        className
      )}
    >
      <div className="container flex items-center justify-between h-16">
        <a href={brandHref} className="text-lg font-semibold tracking-tight text-foreground">
          {brand}
        </a>

        {nav.length > 0 && (
          <nav className="hidden md:flex items-center gap-6">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}

        {cta && <div className="flex items-center gap-2">{cta}</div>}
      </div>
    </header>
  )
}

export default Header
