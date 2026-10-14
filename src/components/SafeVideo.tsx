import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'

interface SafeVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string
  alt: string
  poster?: string
  className?: string
}

/**
 * SafeVideo — autoplay-muted-loop background video for hero sections.
 *
 * Behavior:
 * - Renders a <video> with autoPlay, muted, loop, playsInline (iOS Safari requires all four).
 * - While loading OR if the video src is empty, displays the poster image as a static fallback.
 * - On video error, falls back permanently to the poster image (or alt text icon if no poster).
 * - The Chantan post-processor injects the `src` URL after kie.ai Kling generation completes.
 *
 * Used by Opus 4.6 first builds for the hero. Other tiers should use <SafeImage>.
 */
export function SafeVideo({ src, alt, poster, className = '', ...props }: SafeVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v || !src) return
    const onCanPlay = () => setLoaded(true)
    const onError = () => setError(true)
    v.addEventListener('canplay', onCanPlay)
    v.addEventListener('error', onError)
    return () => {
      v.removeEventListener('canplay', onCanPlay)
      v.removeEventListener('error', onError)
    }
  }, [src])

  if (!src || error) {
    if (poster) {
      return (
        <img
          src={poster}
          alt={alt}
          className={className}
        />
      )
    }
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <ImageOff className="h-8 w-8 text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <>
      {!loaded && poster && (
        <img
          src={poster}
          alt={alt}
          className={`${className} absolute inset-0`}
          aria-hidden="true"
        />
      )}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={className}
        aria-label={alt}
        {...props}
      />
    </>
  )
}

export default SafeVideo
