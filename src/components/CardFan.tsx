import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { HierarchyIcon, MonitorIcon, SearchIcon } from './icons'

const PER_SIDE = 9

// Card faces cycle through the site palette; dark ones keep it grounded.
const FACES = [
  'from-sky-400 to-indigo-600',
  'from-slate-800 to-slate-950',
  'from-indigo-500 to-violet-700',
  'from-teal-400 to-sky-600',
  'from-slate-700 to-indigo-950',
  'from-violet-500 to-indigo-700',
  'from-cyan-400 to-teal-600',
  'from-slate-800 to-slate-950',
  'from-indigo-400 to-sky-700',
]

const ICONS = [SearchIcon, MonitorIcon, HierarchyIcon]

type Card = { side: -1 | 1; k: number; left: number; angle: number; height: number; face: string }

// k = distance from the centre gap. Cards near the centre are tall and almost
// edge-on; outer ones are shorter and turn towards the viewer, so they read
// wider and overlap - the "fanned deck" look.
function layout(): Card[] {
  const cards: Card[] = []
  for (const side of [-1, 1] as const) {
    let offset = 2.8
    for (let k = 0; k < PER_SIDE; k++) {
      offset += k === 0 ? 0 : 2.6 + k * 0.62
      cards.push({
        side,
        k,
        left: 50 + side * offset,
        angle: 82 - k * 6.5,
        height: 100 - k * 5.5,
        face: FACES[(k + (side === 1 ? 4 : 0)) % FACES.length],
      })
    }
  }
  return cards
}

const CARDS = layout()

function FanCard({ card, open }: { card: Card; open: boolean }) {
  const Icon = ICONS[card.k % ICONS.length]
  // Left cards turn their inner edge away, right cards mirror it. Closed =
  // fully edge-on, so the fan "opens" when the panel scrolls into view.
  const rotate = card.side * (open ? card.angle : 90)
  return (
    <div
      className="absolute bottom-0 [transform-style:preserve-3d]"
      style={{
        left: `${card.left}%`,
        width: '13%',
        height: `${card.height}%`,
        marginLeft: '-6.5%',
        zIndex: PER_SIDE - card.k,
        transform: `translateY(14%) rotateY(${rotate}deg)`,
        transition: 'transform 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: `${card.k * 70}ms`,
      }}
    >
      <div
        className="h-full w-full animate-sway motion-reduce:animate-none"
        style={{ animationDelay: `${-card.k * 0.45}s` }}
      >
        <div
          className={`relative h-full w-full overflow-hidden rounded-t-[1.75rem] rounded-b-md bg-gradient-to-br ${card.face} shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]`}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/30" />
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white/15 to-transparent" />
          <Icon className="absolute top-[22%] left-1/2 hidden h-1/3 w-auto -translate-x-1/2 text-white/20 sm:block" />
        </div>
      </div>
    </div>
  )
}

export default function CardFan({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 40 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOpen(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Moving the perspective origin with the cursor makes the whole deck turn
  // slightly towards it.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setOrigin({ x: 50 + (x - 50) * 0.5, y: 40 + (y - 50) * 0.3 })
  }

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onPointerMove={onMove}
      onPointerLeave={() => setOrigin({ x: 50, y: 40 })}
      className={`relative h-48 overflow-hidden rounded-[2rem] sm:h-72 lg:h-80 ${className}`}
      style={{
        perspective: '1100px',
        perspectiveOrigin: `${origin.x}% ${origin.y}%`,
        transition: 'perspective-origin 0.6s ease-out',
      }}
    >
      {CARDS.map((card) => (
        <FanCard key={`${card.side}-${card.k}`} card={card} open={open} />
      ))}
    </div>
  )
}
