import { useEffect, useRef, useState } from 'react'

const stats = [
  { target: 12000, suffix: '+', label: 'tasks completed autonomously' },
  { target: 40, suffix: '%', label: 'average time saved per team' },
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

  return (
    <section id="about" className="bg-white px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-sky-600 uppercase">
          About Agentis
        </span>
        <h2 className="font-display mt-4 text-balance text-4xl text-slate-900 sm:text-5xl">
          A workforce of AI agents, built into your company
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">
          Agentis turns plain-language instructions into finished work.
          Describe the outcome you need — a sales sequence, a landing page, a
          support reply — and a specialized agent picks it up, does the work,
          and hands it back for your review. No hiring, no onboarding, no
          waiting.
        </p>
      </div>

      <div
        ref={rowRef}
        className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-10 sm:grid-cols-3"
      >
        {stats.map((stat) => (
          <StatTile key={stat.label} {...stat} active={active} />
        ))}
        <div className="text-center">
          <div className="font-display text-4xl text-slate-900 sm:text-5xl">
            24/7
          </div>
          <p className="mt-2 text-sm text-slate-500">agents on the clock</p>
        </div>
      </div>
    </section>
  )
}
