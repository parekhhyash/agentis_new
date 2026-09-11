import { useEffect, useRef, useState } from 'react'

const text =
  "Agentis isn't another tool you have to learn. It's a team that already knows how to sell, design, support, and report — ready the moment you describe what you need. You stay in control. The work just gets done."

const words = text.split(' ')

const FROM = [203, 213, 225] // slate-300
const TO = [15, 23, 42] // slate-900

function wordColor(t: number) {
  const clamped = Math.min(1, Math.max(0, t))
  const rgb = FROM.map((from, i) => Math.round(from + (TO[i] - from) * clamped))
  return `rgb(${rgb.join(',')})`
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
      <div className="sticky top-0 flex h-screen items-center justify-center px-6">
        <p className="font-display max-w-4xl text-center text-3xl leading-snug text-balance sm:text-4xl md:text-5xl">
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
