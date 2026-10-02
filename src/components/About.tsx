import { useEffect, useRef, useState, type ReactNode } from 'react'

import { AGENT_TYPES } from '../lib/agentTypes'
import LogoMarquee from './LogoMarquee'

function useCountUp(target: number, active: boolean, duration = 1600) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    let raf: number
    let start: number | null = null

    const tick = (timestamp: number) => {
      if (start === null) start = timestamp
      const t = Math.min(1, (timestamp - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])

  return value
}

function Tile({ className, children }: { className: string; children: ReactNode }) {
  return <div className={`relative flex flex-col overflow-hidden rounded-3xl p-5 sm:p-7 ${className}`}>{children}</div>
}

function Stat({ value, label, tone }: { value: ReactNode; label: string; tone: 'light' | 'dark' }) {
  return (
    <div>
      <div className={`font-display text-4xl tabular-nums sm:text-6xl ${tone === 'light' ? 'text-white' : 'text-slate-900'}`}>
        {value}
      </div>
      <p className={`mt-1 text-sm sm:text-[15px] ${tone === 'light' ? 'text-white/85' : 'text-slate-700'}`}>{label}</p>
    </div>
  )
}

const FEED = [
  { task: 'Qualified 5 D2C leads', when: '2m ago' },
  { task: 'Drafted a 3-step outreach sequence', when: '9m ago' },
  { task: 'Sent the Monday report', when: '1h ago' },
]

function TasksTile({ active }: { active: boolean }) {
  const value = useCountUp(12000, active)
  return (
    <Tile className="col-span-1 bg-brand-blue lg:col-span-4">
      <Stat value={`${value.toLocaleString()}+`} label="tasks completed autonomously" tone="light" />
      <ul className="mt-6 hidden space-y-2 sm:block" aria-hidden="true">
        {FEED.map((item, i) => (
          <li
            key={item.task}
            className="flex items-center gap-3 rounded-xl bg-white/12 px-3 py-2 text-sm text-white backdrop-blur-sm"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'none' : 'translateY(10px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              transitionDelay: `${300 + i * 180}ms`,
            }}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand-blue">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex-1 truncate">{item.task}</span>
            <span className="text-xs text-white/70">{item.when}</span>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

const RING_R = 42
const RING_C = 2 * Math.PI * RING_R

function TimeSavedTile({ active }: { active: boolean }) {
  const value = useCountUp(40, active)
  return (
    <Tile className="col-span-1 bg-brand-pink lg:col-span-2">
      <svg viewBox="0 0 100 100" className="mb-4 h-16 w-16 -rotate-90 sm:mb-auto sm:h-24 sm:w-24" aria-hidden="true">
        <circle cx="50" cy="50" r={RING_R} fill="none" strokeWidth="10" className="stroke-white/60" />
        <circle
          cx="50"
          cy="50"
          r={RING_R}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-slate-900"
          strokeDasharray={RING_C}
          strokeDashoffset={active ? RING_C * 0.6 : RING_C}
          style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="mt-auto pt-4">
        <Stat value={`${value}%`} label="average time saved per team" tone="dark" />
      </div>
    </Tile>
  )
}

function AlwaysOnTile() {
  return (
    <Tile className="col-span-1 bg-brand-violet lg:col-span-2">
      <div className="mb-4 flex items-center justify-between sm:mb-auto">
        <svg viewBox="0 0 100 100" className="h-16 w-16 sm:h-24 sm:w-24" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <line
              key={i}
              x1="50"
              y1="6"
              x2="50"
              y2={i % 6 === 0 ? 16 : 12}
              strokeWidth={i % 6 === 0 ? 3 : 2}
              strokeLinecap="round"
              className="stroke-white/50"
              transform={`rotate(${i * 15} 50 50)`}
            />
          ))}
          <g className="origin-center animate-[spin_12s_linear_infinite] motion-reduce:animate-none">
            <line x1="50" y1="50" x2="50" y2="22" strokeWidth="3" strokeLinecap="round" className="stroke-white" />
          </g>
          <circle cx="50" cy="50" r="4" className="fill-white" />
        </svg>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live
        </span>
      </div>
      <div className="mt-auto pt-4">
        <Stat value="24/7" label="agents on the clock" tone="light" />
      </div>
    </Tile>
  )
}

function AgentsTile({ active }: { active: boolean }) {
  const value = useCountUp(AGENT_TYPES.length, active, 900)
  return (
    <Tile className="col-span-1 border border-slate-200 bg-white lg:col-span-4">
      <Stat value={value} label="specialized agents, one workspace" tone="dark" />
      <ul className="mt-5 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2" aria-label="Agents">
        {AGENT_TYPES.map(({ value: key, label, icon: Icon }, i) => (
          <li
            key={key}
            title={label}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 sm:rounded-full sm:border sm:border-slate-200 sm:bg-slate-50 sm:py-1.5 sm:pr-3 sm:pl-1.5"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'none' : 'scale(0.9)',
              transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
              transitionDelay: `${200 + i * 80}ms`,
            }}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full sm:h-6 sm:w-6 ${
                ['bg-brand-blue text-white', 'bg-brand-violet text-white', 'bg-brand-sky text-white', 'bg-brand-pink text-slate-900', 'bg-brand-yellow text-slate-900', 'bg-brand-mauve text-white', 'bg-brand-orchid text-white'][i % 7]
              }`}
            >
              <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </span>
            {/* Icons only on phones; names from sm up (still read out on phones). */}
            <span className="sr-only sm:not-sr-only">{label}</span>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

export default function About() {
  const gridRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // relative z-10 with no background: sits above the scroll-reveal rings that
  // extend up into this section, while the rings still show behind it.
  return (
    <section id="about" className="relative z-10 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-brand-blue uppercase">
          About Agentis
        </span>
        <h2 className="font-display mt-4 text-balance text-4xl text-slate-900 sm:text-5xl">
          A workforce of AI agents, built into your company
        </h2>
      </div>

      {/* Bento: tasks + time saved, then always-on + the agent roster. 2 x 2 on mobile. */}
      <div
        ref={gridRef}
        className="mx-auto mt-14 grid max-w-[78rem] grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-6 min-[1680px]:max-w-[86rem]"
      >
        <TasksTile active={active} />
        <TimeSavedTile active={active} />
        <AlwaysOnTile />
        <AgentsTile active={active} />
      </div>

      <div className="mx-auto mt-5 max-w-[78rem] rounded-3xl border border-slate-200 px-6 py-6 sm:px-10 min-[1680px]:max-w-[86rem]">
        <LogoMarquee />
      </div>
    </section>
  )
}
