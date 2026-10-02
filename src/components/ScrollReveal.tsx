import { useEffect, useRef, useState } from 'react'

const text =
  "Agentis isn't another tool you have to learn. It's a team that already knows how to sell, design, support, and report, ready the moment you describe what you need. You stay in control. The work just gets done."

const words = text.split(' ')

const FROM = [203, 213, 225] // slate-300
const TO = [15, 23, 42] // slate-900

function wordColor(t: number) {
  const clamped = Math.min(1, Math.max(0, t))
  const rgb = FROM.map((from, i) => Math.round(from + (TO[i] - from) * clamped))
  return `rgb(${rgb.join(',')})`
}

// Concentric rings, one dashed; `turn` rotates the set slightly as the
// section scrolls so the background drifts with the text reveal.
const TONES = {
  sky: { stroke: 'stroke-brand-sky/45', dot: 'fill-brand-sky/60' },
  orchid: { stroke: 'stroke-brand-orchid/45', dot: 'fill-brand-orchid/60' },
}

function Rings({ className, turn, tone = 'sky' }: { className: string; turn: number; tone?: keyof typeof TONES }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
      style={{ transform: `rotate(${turn}deg)` }}
    >
      {[190, 150, 110, 70].map((r, i) => (
        <circle
          key={r}
          cx="200"
          cy="200"
          r={r}
          strokeWidth="1.5"
          className={i % 2 === 0 ? TONES[tone].stroke : 'stroke-slate-200'}
          strokeDasharray={i === 1 ? '4 10' : undefined}
        />
      ))}
      <circle cx="200" cy="10" r="4" className={TONES[tone].dot} />
      <circle cx="350" cy="200" r="3" className="fill-slate-300" />
    </svg>
  )
}

export default function ScrollReveal() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0

    const measure = () => {
      const el = sectionRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const scrolled = -rect.top
      const p = scrollable > 0 ? scrolled / scrollable : 0
      setProgress(Math.min(1, Math.max(0, p)))
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section ref={sectionRef} className="relative bg-white" style={{ height: '250vh' }}>
      {/* overflow-x-clip (not overflow-hidden): stops sideways scroll but lets
          the rings run past the section's top and bottom into the
          neighbouring sections instead of being cut off at its edges. */}
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-x-clip px-6">
        <Rings className="-top-32 -left-24 w-72 sm:-top-44 sm:-left-28 sm:w-[28rem]" turn={progress * 60} />
        <Rings className="-right-28 -bottom-36 w-80 sm:-right-36 sm:-bottom-52 sm:w-[34rem]" turn={-progress * 45} tone="orchid" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/10 blur-3xl"
        />
        <p className="font-display relative max-w-4xl text-center text-3xl leading-snug text-balance sm:text-4xl md:text-5xl">
          {words.map((word, i) => (
            <span
              key={i}
              style={{ color: wordColor(progress * words.length - i) }}
            >
              {word}{' '}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
