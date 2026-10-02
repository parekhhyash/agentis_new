import { useEffect, useRef, useState } from 'react'

// A single statement over five faint, evenly overlapping circles. The first
// time the section scrolls into view, the circles fan out from the centre one.
const CIRCLES = 5
const R = 160
const STEP = 120 // centre-to-centre distance; < 2R so neighbours intersect
const WIDTH = 2 * R + STEP * (CIRCLES - 1)
const CENTRE = WIDTH / 2

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function QuoteCircles() {
  const ref = useRef<HTMLDivElement>(null)
  const [spread, setSpread] = useState(prefersReducedMotion)

  useEffect(() => {
    const el = ref.current
    if (!el || spread) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSpread(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [spread])

  return (
    <section className="relative z-10 overflow-x-clip px-4 py-20 sm:px-6 sm:py-28">
      <div ref={ref} className="relative mx-auto flex max-w-[78rem] items-center justify-center min-[1680px]:max-w-[86rem]">
        <svg
          viewBox={`0 0 ${WIDTH} ${2 * R}`}
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 w-[160%] max-w-none -translate-x-1/2 -translate-y-1/2 sm:w-full sm:max-w-4xl"
          fill="none"
        >
          {Array.from({ length: CIRCLES }, (_, i) => {
            const cx = R + i * STEP
            const fromCentre = Math.abs(cx - CENTRE) / STEP // 0 for the middle circle, 1-2 for the rest
            return (
              <circle
                key={i}
                cx={cx}
                cy={R}
                r={R - 1}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                className="stroke-slate-200"
                style={{
                  // Untransformed = final position; before the spread each circle
                  // is shifted onto the centre one.
                  transform: spread ? 'none' : `translateX(${CENTRE - cx}px)`,
                  opacity: spread || fromCentre === 0 ? 1 : 0,
                  transition: 'transform 1.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease-out',
                  transitionDelay: `${150 + fromCentre * 120}ms`,
                }}
              />
            )
          })}
        </svg>
        <p className="font-display relative py-16 text-center text-4xl text-balance text-slate-900 sm:py-24 sm:text-6xl">
          Built to do the work, so you can lead.
        </p>
      </div>
    </section>
  )
}
