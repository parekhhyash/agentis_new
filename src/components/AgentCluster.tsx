import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { BarChartIcon, HeadsetIcon, MegaphoneIcon, PencilIcon, SearchIcon, type IconComponent } from './icons'

// The same icons the agents use in the app, one solid brand colour each.
const TILES: { icon: IconComponent; label: string; tile: string }[] = [
  { icon: SearchIcon, label: 'Lead research', tile: 'bg-brand-blue text-white' },
  { icon: MegaphoneIcon, label: 'Sales & outreach', tile: 'bg-brand-violet text-white' },
  { icon: HeadsetIcon, label: 'Customer support', tile: 'bg-brand-sky text-white' },
  { icon: BarChartIcon, label: 'Data & reporting', tile: 'bg-brand-yellow text-ink' },
  { icon: PencilIcon, label: 'Content & copy', tile: 'bg-brand-pink text-ink' },
]

const TILTS = [-8, 14, -12, 10, -16]
// Before the first reveal the tiles sit in one neat pile, each nudged a
// little so it reads as a stack of cards rather than a single tile.
const STACK_TILTS = [-6, 4, -2, 6, 0]
const STEP = 360 / TILES.length

type Phase = 'stack' | 'lift' | 'spread' | 'settled'

// Stacked -> lifted to the top of the circle -> swept round to their slots
// like a loading spinner. Plays once, the first time the box is in view.
// Reduced motion skips straight to the circle.
function useSpread() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState<Phase>(reduced ? 'settled' : 'stack')

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    let timers: number[] = []
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        timers = [
          window.setTimeout(() => setPhase('lift'), 250),
          window.setTimeout(() => setPhase('spread'), 650),
          window.setTimeout(() => setPhase('settled'), 1900),
        ]
      },
      { threshold: 0.6 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [reduced])

  return { ref, phase }
}

// Every state uses the same transform list (orbit angle, radius, undo the
// orbit, tilt), so the browser interpolates the angle itself and the tiles
// travel along the circle rather than in straight lines.
// Radii are written out (34px rest, 46px hover) so Tailwind can see the classes.
const POSE: Record<Phase, string> = {
  stack: '[transform:rotate(0deg)_translateY(var(--sy))_rotate(0deg)_rotate(var(--sr))]',
  lift: '[transform:rotate(0deg)_translateY(-34px)_rotate(0deg)_rotate(var(--sr))]',
  spread: '[transform:rotate(var(--a))_translateY(-34px)_rotate(calc(-1*var(--a)))_rotate(var(--r))]',
  settled:
    '[transform:rotate(var(--a))_translateY(-34px)_rotate(calc(-1*var(--a)))_rotate(var(--r))] group-hover:[transform:rotate(var(--a))_translateY(-46px)_rotate(calc(-1*var(--a)))_rotate(0deg)]',
}

// Five tilted app tiles arranged around a circle, like a hand of cards.
function Cluster({ phase }: { phase: Phase }) {
  return (
    <div className="relative h-36 w-36 shrink-0" aria-hidden="true">
      {TILES.map(({ icon: Icon, tile }, i) => {
        const angle = i * STEP
        // Same angular speed for every tile, so the ones going further round
        // keep moving after the nearer ones have stopped: a spinner's trail.
        const duration = phase === 'lift' ? 380 : phase === 'spread' ? 350 + angle * 3 : 500
        const style = {
          '--a': `${angle}deg`,
          '--r': `${TILTS[i]}deg`,
          '--sy': `${(TILES.length - 1 - i) * -2}px`,
          '--sr': `${STACK_TILTS[i]}deg`,
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: phase === 'lift' ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.33, 1, 0.68, 1)',
          zIndex: i === 0 ? 1 : 5 - i,
        } as CSSProperties
        return (
          <span
            key={i}
            style={style}
            className={`absolute top-1/2 left-1/2 -mt-6 -ml-6 flex h-12 w-12 items-center justify-center rounded-xl shadow-md ring-2 ring-white transition-transform dark:ring-zinc-100 ${POSE[phase]} ${tile}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        )
      })}
    </div>
  )
}

export default function AgentCluster() {
  const { ref, phase } = useSpread()
  return (
    <div
      ref={ref}
      className="group mx-auto mt-10 flex max-w-[78rem] min-[1680px]:max-w-[86rem] flex-col items-center justify-center gap-8 rounded-3xl bg-zinc-100 px-6 py-14 text-center sm:flex-row sm:gap-12 sm:py-16 sm:text-left"
    >
      <Cluster phase={phase} />
      <p className="max-w-md text-lg leading-snug text-slate-900 sm:text-xl">
        Every agent your business needs, in one workspace: from finding leads to answering
        customers to the Monday report.
      </p>
    </div>
  )
}
