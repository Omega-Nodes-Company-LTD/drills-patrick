'use client'

import { Children, useEffect, useRef, useState, useCallback } from 'react'

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
  const slidesRef = useRef<HTMLDivElement>(null)
  const isAnimating = useRef(false)

  const goToSlide = useCallback(
    (index: number) => {
      if (isAnimating.current || index < 0 || index >= slideCount) return
      isAnimating.current = true
      setCurrentIndex(index)
      onSlideChange?.(index)
      setTimeout(() => { isAnimating.current = false }, 700)
    },
    [slideCount, onSlideChange],
  )

  const nextSlide = useCallback(() => goToSlide((currentIndex + 1) % slideCount), [currentIndex, slideCount, goToSlide])
  const prevSlide = useCallback(() => goToSlide((currentIndex - 1 + slideCount) % slideCount), [currentIndex, slideCount, goToSlide])

  useEffect(() => {
    if (autoplayInterval <= 0 || slideCount <= 1) return
    const id = setInterval(() => { if (!isHovered) nextSlide() }, autoplayInterval)
    return () => clearInterval(id)
  }, [autoplayInterval, slideCount, isHovered, nextSlide])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !pauseOnHover) return
    const enter = () => setIsHovered(true)
    const leave = () => setIsHovered(false)
    el.addEventListener('mouseenter', enter)
    el.addEventListener('mouseleave', leave)
    return () => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave) }
  }, [pauseOnHover])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') prevSlide(); if (e.key === 'ArrowRight') nextSlide() }
    const el = containerRef.current
    el?.addEventListener('keydown', handler)
    return () => el?.removeEventListener('keydown', handler)
  }, [prevSlide, nextSlide])

  const touchStartRef = useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return
    const diff = touchStartRef.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) { if (diff > 0) nextSlide(); else prevSlide() }
    touchStartRef.current = null
  }

  useEffect(() => {
    if (!slidesRef.current) return
    slidesRef.current.style.transform = 'translateX(' + (-currentIndex * 100) + '%)'
  }, [currentIndex, transition])

  useEffect(() => {
    if (transition !== 'fade' || !containerRef.current) return
    containerRef.current.querySelectorAll('[data-slide]').forEach((slide, i) => {
      const el = slide as HTMLElement
      el.style.opacity = i === currentIndex ? '1' : '0'
      el.style.zIndex = i === currentIndex ? '10' : '0'
    })
  }, [currentIndex, transition])

  if (slideCount <= 1) return <>{children}</>

  return (
    <div ref={containerRef} className="relative" role="region" aria-label="Slideshow" aria-roledescription="carousel" tabIndex={0} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div ref={slidesRef} className="flex transition-transform duration-700 ease-out" data-slideshow-track>
        {Children.toArray(children).map((child, index) => (
          <div key={index} className={"flex-shrink-0 w-full " + (transition === 'fade' ? 'absolute inset-0 transition-opacity duration-700 ' : '') + (index === currentIndex ? (transition === 'fade' ? 'opacity-100 z-10' : '') : (transition === 'fade' ? 'opacity-0 z-0' : ''))} style={transition === 'fade' && index !== currentIndex ? { position: 'absolute', inset: 0 } : {}} data-slide={index} role="group" aria-roledescription="slide" aria-label={"Slide " + (index + 1) + " of " + slideCount} aria-current={index === currentIndex ? 'true' : 'false'}>
            {child}
          </div>
        ))}
      </div>

      {showArrows && (
        <>
          <button type="button" onClick={prevSlide} disabled={isAnimating.current} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 size-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none" aria-label="Previous slide"><svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg></button>
          <button type="button" onClick={nextSlide} disabled={isAnimating.current} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 size-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none" aria-label="Next slide"><svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></button>
        </>
      )}

      {showDots && (
        <nav className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2" aria-label="Slide navigation">
          {Array.from({ length: slideCount }).map((_, index) => (
            <button key={index} type="button" onClick={() => goToSlide(index)} disabled={isAnimating.current} className={"size-2 rounded-full transition-all " + (index === currentIndex ? 'bg-primary w-6' : 'bg-foreground/50 hover:bg-foreground/75') + " disabled:opacity-50 disabled:pointer-events-none"} aria-label={"Go to slide " + (index + 1)} aria-current={index === currentIndex ? 'true' : 'false'} />
          ))}
        </nav>
      )}
    </div>
  )
}