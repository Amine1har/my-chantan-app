import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  className?: string
}

/**
 * SafeImage — loads an image with a graceful fade-in and an error fallback.
 *
 * Bugfix (Apr 15 2026): previous version used `loading="lazy"` combined with
 * `position: absolute; opacity: 0` while loading, which stopped Chrome/Safari
 * from ever scheduling the network fetch (the browser's lazy-load heuristic
 * treats absolute+opacity-0 elements as invisible, so they never "enter the
 * viewport" for load triggering). Result: images stayed invisible until a
 * repaint (e.g. mouseover) woke the loader up. Fix: keep the <img> in normal
 * flow and use opacity-only transitions. The placeholder overlays via
 * absolute inset-0 inside a relative wrapper.
 *
 * Bugfix (Jul 12 2026): the wrapper classes MUST merge via cn()/tailwind-merge,
 * not string concat. With concat, a caller passing `absolute inset-0` (the
 * standard full-bleed hero background pattern) silently LOST: both `relative`
 * and `absolute` landed on the element and Tailwind's stylesheet order makes
 * `relative` win, so the "background" image joined normal flex flow and
 * squeezed the hero into two columns. cn() resolves conflicts caller-wins.
 */
export function SafeImage({ src, alt, className = '', ...props }: SafeImageProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Cached / synchronously-decoded images can finish loading BEFORE React
  // attaches the onLoad handler, so onLoad never fires and the <img> would stay
  // at opacity-0 forever (invisible). A callback ref catches that case: if the
  // element is already complete on mount, reveal it immediately.
  const captureImg = (node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) setLoaded(true)
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center bg-muted', className)}>
        <ImageOff className="h-8 w-8 text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
      )}
      <img
        ref={captureImg}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        {...props}
      />
    </div>
  )
}

export default SafeImage
