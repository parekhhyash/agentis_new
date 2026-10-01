import { useState, type CSSProperties, type PointerEvent } from 'react'

import { QuoteIcon } from './icons'

// Placeholder testimonials - replace with real customer quotes.
const testimonials = [
  {
    quote: 'We replaced three weekly ops tasks with one Agentis workflow. It just runs now.',
    name: 'Priya Nair',
    role: 'COO, Fernway Logistics',
    initials: 'PN',
    outcome: '3 weekly ops tasks → 1 workflow',
    accent: 'from-sky-400 to-indigo-500',
  },
  {
    quote:
      'Our outbound sequences used to take a full day to write. Agentis drafts them before our morning standup.',
    name: 'Marcus Lee',
    role: 'Head of Sales, Northloop',
    initials: 'ML',
    outcome: 'Sequences drafted before standup',
    accent: 'from-indigo-400 to-violet-500',
  },
  {
    quote:
      'I described the landing page I wanted and had a working version to review in under ten minutes.',
    name: 'Sofia Reyes',
    role: 'Founder, Reyes Studio',
    initials: 'SR',
    outcome: 'Landing page in under 10 minutes',
    accent: 'from-violet-400 to-fuchsia-500',
  },
  {
    quote:
      'Support tickets that used to wait overnight now get a first reply in minutes, and my team handles the tricky ones.',
    name: 'Aisha Khan',
    role: 'Head of Support, Brightcart',
    initials: 'AK',
    outcome: 'First replies in minutes, not hours',
    accent: 'from-teal-300 to-sky-500',
  },
  {
    quote: 'Our Monday report writes itself. I just read it with my coffee.',
    name: 'Daniel Okafor',
    role: 'Finance Lead, Meridian Foods',
    initials: 'DO',
    outcome: 'Weekly report, fully automated',
    accent: 'from-cyan-300 to-teal-500',
  },
  {
    quote: 'It found us qualified leads in a market we had never sold into, with sources for every one.',
    name: 'Hana Sato',
    role: 'Growth, Kumo Labs',
    initials: 'HS',
    outcome: 'New market, sourced leads',
    accent: 'from-sky-300 to-cyan-500',
  },
]

function Avatar({ initials, accent, className = '' }: { initials: string; accent: string; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${accent} ${className}`}
    >
      {initials}
    </span>
  )
}

export default function Testimonials() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const current = testimonials[active]

  // A soft glow follows the cursor across the panel.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  return (
    <section id="testimonials" className="relative z-10 px-4 py-12 sm:px-6 sm:py-16">
      <div
        onPointerMove={onMove}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-20 sm:px-12 sm:py-24"
        style={{ '--mx': '50%', '--my': '30%' } as CSSProperties}
      >
        {/* Aurora + dot grid + cursor glow */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-1/4 -left-1/4 h-[36rem] w-[36rem] animate-aurora rounded-full bg-indigo-600/30 blur-3xl motion-reduce:animate-none" />
          <div
            className="absolute -right-1/4 -bottom-1/3 h-[34rem] w-[34rem] animate-aurora rounded-full bg-sky-500/25 blur-3xl motion-reduce:animate-none"
            style={{ animationDelay: '-6s', animationDuration: '22s' }}
          />
          <div
            className="absolute top-1/3 left-1/2 h-[26rem] w-[26rem] animate-aurora rounded-full bg-violet-600/25 blur-3xl motion-reduce:animate-none"
            style={{ animationDelay: '-12s', animationDuration: '26s' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:22px_22px]" />
          <div className="absolute inset-0 bg-[radial-gradient(500px_circle_at_var(--mx)_var(--my),rgba(129,140,248,0.16),transparent_45%)]" />
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold tracking-[0.2em] text-violet-300 uppercase">
            Testimonials
          </span>
          <h2 className="font-display mt-4 text-4xl text-white sm:text-5xl">Teams running on Agentis</h2>
        </div>

        {/* Featured quote: re-keyed on change so it animates in */}
        <figure className="mx-auto mt-14 max-w-3xl text-center">
          <span
            aria-hidden="true"
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg shadow-indigo-500/30 transition-colors duration-700 ${current.accent}`}
          >
            <QuoteIcon className="h-7 w-7 text-white" />
          </span>
          <blockquote
            key={active}
            className="font-display mt-8 animate-quote-in text-2xl leading-snug text-balance text-white sm:text-4xl motion-reduce:animate-none"
          >
            {current.quote}
          </blockquote>
          <figcaption key={`by-${active}`} className="mt-8 animate-quote-in text-sm motion-reduce:animate-none">
            <span className="font-semibold text-white">{current.name}</span>
            <span className="text-slate-400"> · {current.role}</span>
          </figcaption>
        </figure>

        {/* Selector: the active person's bar fills, and finishing advances to the next.
            Hover/focus pauses it; reduced motion turns autoplay off. */}
        <div className="mx-auto mt-12 flex max-w-3xl justify-center gap-2 sm:gap-4">
          {testimonials.map((t, i) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show testimonial from ${t.name}`}
              aria-pressed={i === active}
              className={`group flex w-10 flex-col items-center gap-2 transition-opacity sm:w-14 ${
                i === active ? 'opacity-100' : 'opacity-50 hover:opacity-90'
              }`}
            >
              <Avatar
                initials={t.initials}
                accent={t.accent}
                className={`h-9 w-9 text-[11px] ring-2 ring-offset-2 ring-offset-slate-950 transition sm:h-12 sm:w-12 sm:text-xs ${
                  i === active ? 'scale-110 ring-white/70' : 'ring-transparent group-hover:ring-white/20'
                }`}
              />
              <span className="h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                {i === active && (
                  <span
                    className="block h-full w-full origin-left animate-progress rounded-full bg-white/80 motion-reduce:animate-none motion-reduce:scale-x-100"
                    style={{ animationPlayState: paused ? 'paused' : 'running' }}
                    onAnimationEnd={() => setActive((active + 1) % testimonials.length)}
                  />
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Outcomes strip */}
        <div className="relative mt-16 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-marquee-slow motion-reduce:animate-none">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 gap-4 pr-4">
                {testimonials.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 py-2 pr-5 pl-2 backdrop-blur-sm"
                  >
                    <Avatar initials={t.initials} accent={t.accent} className="h-7 w-7 text-[10px]" />
                    <span className="text-sm whitespace-nowrap text-slate-200">{t.outcome}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
