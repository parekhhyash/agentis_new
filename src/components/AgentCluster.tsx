import type { CSSProperties } from 'react'

import { BarChartIcon, HeadsetIcon, MegaphoneIcon, PencilIcon, SearchIcon, type IconComponent } from './icons'

// The same icons the agents use in the app, one solid brand colour each.
const TILES: { icon: IconComponent; label: string; tile: string }[] = [
  { icon: SearchIcon, label: 'Lead research', tile: 'bg-brand-blue text-white' },
  { icon: MegaphoneIcon, label: 'Sales & outreach', tile: 'bg-brand-violet text-white' },
  { icon: HeadsetIcon, label: 'Customer support', tile: 'bg-brand-sky text-white' },
  { icon: BarChartIcon, label: 'Data & reporting', tile: 'bg-brand-yellow text-slate-900' },
  { icon: PencilIcon, label: 'Content & copy', tile: 'bg-brand-pink text-slate-900' },
]

const RADIUS = 34 // px from the cluster centre at rest
const SPREAD = 46 // px on hover, so the tiles fan out a little
const TILTS = [-8, 14, -12, 10, -16]

// Five tilted app tiles arranged around a circle, like a hand of cards.
function Cluster() {
  return (
    <div className="relative h-36 w-36 shrink-0" aria-hidden="true">
      {TILES.map(({ icon: Icon, tile }, i) => {
        const angle = ((-90 + i * 72) * Math.PI) / 180
        const style = {
          '--x': `${Math.cos(angle) * RADIUS}px`,
          '--y': `${Math.sin(angle) * RADIUS}px`,
          '--hx': `${Math.cos(angle) * SPREAD}px`,
          '--hy': `${Math.sin(angle) * SPREAD}px`,
          '--r': `${TILTS[i]}deg`,
          zIndex: i === 0 ? 1 : 5 - i,
        } as CSSProperties
        return (
          <span
            key={i}
            style={style}
            className={`absolute top-1/2 left-1/2 -mt-6 -ml-6 flex h-12 w-12 items-center justify-center rounded-xl shadow-md ring-2 ring-white transition-transform duration-500 [transform:translate(var(--x),var(--y))_rotate(var(--r))] group-hover:[transform:translate(var(--hx),var(--hy))_rotate(0deg)] ${tile}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        )
      })}
    </div>
  )
}

export default function AgentCluster() {
  return (
    <div className="group mx-auto mt-10 flex max-w-[78rem] min-[1680px]:max-w-[86rem] flex-col items-center justify-center gap-8 rounded-3xl bg-zinc-100 px-6 py-14 text-center sm:flex-row sm:gap-12 sm:py-16 sm:text-left">
      <Cluster />
      <p className="max-w-md text-lg leading-snug text-slate-900 sm:text-xl">
        Every agent your business needs, in one workspace: from finding leads to answering
        customers to the Monday report.
      </p>
    </div>
  )
}
