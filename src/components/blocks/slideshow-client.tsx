'use client'

import { Children, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface SlideshowWrapperProps {
  children: React.ReactNode
  slideCount: number
  autoplayInterval: number
  pauseOnHover: boolean
  transition: 'slide' | 'fade'
  showArrows: boolean
  showDots: boolean
  onSlideChange?: (index: number) => void
}

/** Matches `duration-700` on the track and the slides. */
const TRANSITION_MS = 700

/**
 * The interactive half of the slideshow block.
 *
 * Every slide is positioned by what is rendered, never by writing styles onto
 * the DOM after the fact. The two transitions lay slides out differently — a
 * row that is translated, or a stack whose opacity changes — and moving the
 * track is only meaningful for the row. Translating a stack takes every slide
 * out of the frame together, which is how the fade transition showed the first
 * picture and then an empty panel while the dots kept advancing.
 */
export function SlideshowWrapper({
  children,
  slideCount,
  autoplayInterval,
  pauseOnHover,
  transition,
  showArrows,
  showDots,
  onSlideChange,
}: SlideshowWrapperProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // A ref rather than state: it only guards against a second move starting
  // mid-transition and must not re-render. For the same reason it cannot drive
  // `disabled` on the controls — nothing re-renders when it clears, so the
  // buttons stayed disabled after the first click.
  const isAnimating = useRef(false)

  const goToSlide = useCallback(
    (index: number) => {
      if (isAnimating.current || index < 0 || index >= slideCount) return
      isAnimating.current = true
      setCurrentIndex(index)
      onSlideChange?.(index)
      setTimeout(() => {
        isAnimating.current = false
      }, TRANSITION_MS)
    },
    [slideCount, onSlideChange],
  )

  const nextSlide = useCallback(
    () => goToSlide((currentIndex + 1) % slideCount),
    [currentIndex, slideCount, goToSlide],
  )
  const prevSlide = useCallback(
    () => goToSlide((currentIndex - 1 + slideCount) % slideCount),
    [currentIndex, slideCount, goToSlide],
  )

  useEffect(() => {
    if (autoplayInterval <= 0 || slideCount <= 1) return
    const id = setInterval(() => {
      if (!isHovered) nextSlide()
    }, autoplayInterval)
    return () => clearInterval(id)
  }, [autoplayInterval, slideCount, isHovered, nextSlide])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !pauseOnHover) return
    const enter = () => setIsHovered(true)
    const leave = () => setIsHovered(false)
    el.addEventListener('mouseenter', enter)
    el.addEventListener('mouseleave', leave)
    return () => {
      el.removeEventListener('mouseenter', enter)
      el.removeEventListener('mouseleave', leave)
    }
  }, [pauseOnHover])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      // Without preventDefault the arrow keys also scroll the page sideways.
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevSlide()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextSlide()
      }
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [prevSlide, nextSlide])

  const touchStartRef = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0]?.clientX
    if (x == null) return
    touchStartRef.current = x
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return
    const x = e.changedTouches[0]?.clientX
    if (x == null) return
    const diff = touchStartRef.current - x
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextSlide()
      else prevSlide()
    }
    touchStartRef.current = null
  }

  if (slideCount <= 1) return <div className="absolute inset-0">{children}</div>

  const isSlide = transition === 'slide'

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      role="region"
      aria-label="Slideshow"
      aria-roledescription="carousel"
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={cn('absolute inset-0', isSlide && 'flex transition-transform duration-700 ease-out')}
        style={isSlide ? { transform: `translateX(-${currentIndex * 100}%)` } : undefined}
        data-slideshow-track
      >
        {Children.toArray(children).map((child, index) => {
          const isCurrent = index === currentIndex
          return (
            <div
              key={index}
              className={cn(
                isSlide
                  ? 'relative min-w-full flex-shrink-0'
                  : 'absolute inset-0 transition-opacity duration-700',
                !isSlide && (isCurrent ? 'z-10 opacity-100' : 'z-0 opacity-0'),
              )}
              data-slide={index}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${slideCount}`}
              aria-current={isCurrent ? 'true' : 'false'}
            >
              {child}
            </div>
          )
        })}
      </div>

      {showArrows && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            className="absolute left-4 top-1/2 z-20 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Previous slide"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="absolute right-4 top-1/2 z-20 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Next slide"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </>
      )}

      {showDots && (
        <nav className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2" aria-label="Slide navigation">
          {Array.from({ length: slideCount }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              className={cn(
                'size-2 rounded-full transition-all',
                index === currentIndex ? 'w-6 bg-primary' : 'bg-foreground/50 hover:bg-foreground/75',
              )}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
            />
          ))}
        </nav>
      )}
    </div>
  )
}
