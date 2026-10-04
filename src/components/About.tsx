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

// light: white text on a brand tile (dark text in dark mode). dark: theme text on the neutral tile.
// ink: always-dark text on the yellow tile.
const STAT_TONES = {
  light: ['text-white dark:text-ink', 'font-medium text-white dark:text-ink'],
  dark: ['text-slate-900', 'text-slate-700'],
  ink: ['text-ink', 'text-ink/80'],
}

function Stat({ value, label, tone }: { value: ReactNode; label: string; tone: keyof typeof STAT_TONES }) {
  const [valueClass, labelClass] = STAT_TONES[tone]
  return (
    <div>
      <div className={`font-display text-4xl tabular-nums sm:text-6xl ${valueClass}`}>
        {value}
      </div>
      <p className={`mt-1 text-sm sm:text-[15px] ${labelClass}`}>{label}</p>
    </div>
  )
}

// Deterministic "activity" levels (0-4) for the tasks heatmap, busier towards
// the most recent weeks on the right.
function activity(col: number, row: number) {
  const n = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453
  const noise = n - Math.floor(n)
  const trend = col / 18
  return Math.min(4, Math.floor((noise * 0.7 + trend * 0.6) * 5))
}

// White squares on the blue tile; dark ones in dark mode, matching the text.
const LEVELS = [
  'bg-white/10 dark:bg-ink/10',
  'bg-white/25 dark:bg-ink/25',
  'bg-white/45 dark:bg-ink/45',
  'bg-white/70 dark:bg-ink/70',
  'bg-white dark:bg-ink',
]

function Heatmap({ cols, active, className }: { cols: number; active: boolean; className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`grid grid-flow-col grid-rows-7 gap-1 sm:gap-1.5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cols * 7 }, (_, i) => {
        const col = Math.floor(i / 7)
        const level = activity(col + (18 - cols), i % 7)
        return (
          <span
            key={i}
            className={`aspect-square rounded-[3px] ${LEVELS[level]}`}
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'none' : 'scale(0.4)',
              transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
              transitionDelay: `${col * 45}ms`,
            }}
          />
        )
      })}
    </div>
  )
}

function TasksTile({ active }: { active: boolean }) {
  const value = useCountUp(12000, active)
  return (
    <Tile className="col-span-1 justify-between gap-6 bg-brand-blue lg:col-span-4 lg:flex-row lg:items-end">
      <div className="order-2 lg:order-1 lg:shrink-0">
        <Stat value={`${value.toLocaleString()}+`} label="tasks completed autonomously" tone="light" />
      </div>
      <Heatmap cols={10} active={active} className="order-1 w-full lg:hidden" />
      <Heatmap cols={18} active={active} className="order-2 hidden w-full max-w-md lg:grid" />
    </Tile>
  )
}

const HOURS_BEFORE = 10
const HOURS_AFTER = 6

function TimeSavedTile({ active }: { active: boolean }) {
  const value = useCountUp(40, active)
  const bar = (label: string, short: string, hours: number, fill: string, width: number, delay: number) => (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs font-medium text-ink sm:text-[13px]">
        <span>
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        <span className="font-semibold whitespace-nowrap tabular-nums">
          {hours} h<span className="hidden sm:inline">/week</span>
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full ${fill}`}
          style={{
            width: active ? `${width}%` : '0%',
            transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
            transitionDelay: `${delay}ms`,
          }}
        />
      </div>
    </div>
  )
  return (
    <Tile className="col-span-1 justify-between gap-6 bg-brand-yellow lg:col-span-2">
      <div className="space-y-3" aria-hidden="true">
        {bar('Without Agentis', 'Before', HOURS_BEFORE, 'bg-white', 100, 100)}
        {bar('With Agentis', 'After', HOURS_AFTER, 'bg-ink', (HOURS_AFTER / HOURS_BEFORE) * 100, 500)}
      </div>
      <Stat value={`${value}%`} label="average time saved per team" tone="ink" />
    </Tile>
  )
}

function AlwaysOnTile() {
  return (
    <Tile className="col-span-1 bg-brand-blush lg:col-span-2">
      <div className="mb-4 sm:mb-auto">
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
              className="stroke-white/50 dark:stroke-ink/50"
              transform={`rotate(${i * 15} 50 50)`}
            />
          ))}
          <g className="origin-center animate-[spin_12s_linear_infinite] motion-reduce:animate-none">
            <line x1="50" y1="50" x2="50" y2="22" strokeWidth="3" strokeLinecap="round" className="stroke-white dark:stroke-ink" />
          </g>
          <circle cx="50" cy="50" r="4" className="fill-white dark:fill-ink" />
        </svg>
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
    <Tile className="col-span-1 border border-slate-200 bg-surface lg:col-span-4">
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
                ['bg-brand-blue text-white', 'bg-brand-violet text-white', 'bg-brand-sky text-white', 'bg-brand-pink text-ink', 'bg-brand-yellow text-ink', 'bg-brand-mauve text-white', 'bg-brand-orchid text-white'][i % 7]
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

  // A rounded sheet that slides up over the bottom of the hero image, so the
  // switch from the photo to the plain page reads as deliberate.
  return (
    <section
      id="about"
      className="relative z-10 -mt-12 rounded-t-[2.5rem] bg-page px-4 py-24 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] sm:-mt-16 sm:rounded-t-[3.5rem] sm:px-6 sm:py-32"
    >
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
