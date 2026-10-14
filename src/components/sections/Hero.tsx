import { type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SafeImage } from "@/components/SafeImage"

interface Props {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  primaryCta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  image?: { src: string; alt: string }
  align?: "left" | "center"
  className?: string
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  image,
  align = "center",
  className,
}: Props) {
  const isCentered = align === "center"
  const hasImage = !!image

  return (
    <section className={cn("w-full py-20 md:py-28", className)}>
      <div
        className={cn(
          "container",
          hasImage ? "grid grid-cols-1 lg:grid-cols-2 gap-12 items-center" : ""
        )}
      >
        <div className={cn("space-y-6", isCentered && !hasImage && "max-w-3xl mx-auto text-center")}>
          {eyebrow && (
            <div className="inline-flex items-center text-xs font-medium tracking-wide uppercase text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
          {(primaryCta || secondaryCta) && (
            <div
              className={cn(
                "flex flex-col sm:flex-row gap-3",
                isCentered && !hasImage && "justify-center"
              )}
            >
              {primaryCta && (
                <a
                  href={primaryCta.href}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                >
                  {primaryCta.label}
                </a>
              )}
              {secondaryCta && (
                <a
                  href={secondaryCta.href}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-md border border-border text-foreground font-medium hover:bg-muted transition-colors"
                >
                  {secondaryCta.label}
                </a>
              )}
            </div>
          )}
        </div>

        {hasImage && (
          <div className="relative">
            <SafeImage
              src={image.src}
              alt={image.alt}
              className="w-full h-auto rounded-2xl shadow-2xl"
            />
          </div>
        )}
      </div>
    </section>
  )
}

export default Hero
