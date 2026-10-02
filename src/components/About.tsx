import { useEffect, useRef, useState } from 'react'

import LogoMarquee from './LogoMarquee'

const stats = [
  { target: 12000, suffix: '+', label: 'tasks completed autonomously' },
  { target: 40, suffix: '%', label: 'average time saved per team' },
  { target: 7, suffix: '', label: 'specialized agents' },
] as const

function useCountUp(target: number, active: boolean, duration = 1600) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    let raf: number
    let start: number | null = null

    const tick = (timestamp: number) => {
      if (start === null) start = timestamp
      const elapsed = timestamp - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])

  return value
}

function StatTile({
  target,
  suffix,
  label,
  active,
}: {
  target: number
  suffix: string
  label: string
  active: boolean
}) {
  const value = useCountUp(target, active)

  return (
    <div className="text-center">
      <div className="font-display text-4xl text-slate-900 tabular-nums sm:text-5xl">
        {value.toLocaleString()}
        {suffix}
      </div>
      <p className="mt-2 text-sm text-slate-500">{label}</p>
    </div>
  )
}

export default function About() {
  const rowRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = rowRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true)
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // relative z-10 with no background: sits above the scroll-reveal rings that
  // extend up into this section, while the rings still show behind it.
  return (
    <section id="about" className="relative z-10 px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-brand-blue uppercase">
          About Agentis
        </span>
        <h2 className="font-display mt-4 text-balance text-4xl text-slate-900 sm:text-5xl">
          A workforce of AI agents, built into your company
        </h2>
      </div>

      <div
        ref={rowRef}
        className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4"
      >
        {stats.map((stat) => (
          <StatTile key={stat.label} {...stat} active={active} />
        ))}
        <div className="text-center">
          <div className="font-display text-4xl text-slate-900 tabular-nums sm:text-5xl">
            24/7
          </div>
          <p className="mt-2 text-sm text-slate-500">agents on the clock</p>
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-5xl">
        <LogoMarquee />
      </div>
    </section>
  )
}
