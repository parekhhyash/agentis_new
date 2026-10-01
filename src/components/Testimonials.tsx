import type { CSSProperties, PointerEvent } from 'react'

import { QuoteIcon } from './icons'

// Placeholder testimonials - replace with real customer quotes.
const testimonials = [
  {
    quote: 'We replaced three weekly ops tasks with one Agentis workflow. It just runs now.',
    name: 'Priya Nair',
    role: 'COO, Fernway Logistics',
    initials: 'PN',
    outcome: '3 weekly ops tasks → 1 workflow',
    accent: 'from-sky-300 to-sky-500',
    chip: 'bg-sky-50 text-sky-700',
  },
  {
    quote:
      'Our outbound sequences used to take a full day to write. Agentis drafts them before our morning standup.',
    name: 'Marcus Lee',
    role: 'Head of Sales, Northloop',
    initials: 'ML',
    outcome: 'Sequences drafted before standup',
    accent: 'from-indigo-400 to-violet-500',
    chip: 'bg-indigo-50 text-indigo-700',
  },
  {
    quote:
      'I described the landing page I wanted and had a working version to review in under ten minutes.',
    name: 'Sofia Reyes',
    role: 'Founder, Reyes Studio',
    initials: 'SR',
    outcome: 'Landing page in under 10 minutes',
    accent: 'from-pink-400 to-rose-500',
    chip: 'bg-pink-50 text-pink-700',
  },
  {
    quote:
      'Support tickets that used to wait overnight now get a first reply in minutes, and my team handles the tricky ones.',
    name: 'Aisha Khan',
    role: 'Head of Support, Brightcart',
    initials: 'AK',
    outcome: 'First replies in minutes, not hours',
    accent: 'from-amber-300 to-orange-400',
    chip: 'bg-amber-50 text-amber-700',
  },
  {
    quote: 'Our Monday report writes itself. I just read it with my coffee.',
    name: 'Daniel Okafor',
    role: 'Finance Lead, Meridian Foods',
    initials: 'DO',
    outcome: 'Weekly report, fully automated',
    accent: 'from-fuchsia-400 to-purple-500',
    chip: 'bg-purple-50 text-purple-700',
  },
  {
    quote: 'It found us qualified leads in a market we had never sold into, with sources for every one.',
    name: 'Hana Sato',
    role: 'Growth, Kumo Labs',
    initials: 'HS',
    outcome: 'New market, sourced leads',
    accent: 'from-rose-300 to-red-400',
    chip: 'bg-rose-50 text-rose-700',
  },
]

type Testimonial = (typeof testimonials)[number]

function TestimonialCard({ t, tilt }: { t: Testimonial; tilt: string }) {
  return (
    <figure
      className={`flex w-72 shrink-0 flex-col rounded-3xl border border-white bg-white/80 p-6 shadow-[0_10px_40px_-12px_rgba(99,102,241,0.25)] backdrop-blur-sm transition duration-300 hover:-translate-y-1.5 hover:rotate-0 hover:shadow-[0_20px_50px_-12px_rgba(236,72,153,0.35)] sm:w-80 ${tilt}`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ${t.accent}`}
      >
        <QuoteIcon className="h-5 w-5 text-white" />
      </span>
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-slate-700">{t.quote}</blockquote>
      <span className={`mt-5 self-start rounded-full px-3 py-1 text-xs font-semibold ${t.chip}`}>{t.outcome}</span>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white ${t.accent}`}
        >
          {t.initials}
        </span>
        <span>
          <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
          <span className="block text-xs text-slate-500">{t.role}</span>
        </span>
      </figcaption>
    </figure>
  )
}

// One endlessly scrolling row; the second copy makes the -50% loop seamless.
function CardRow({ items, reverse = false }: { items: Testimonial[]; reverse?: boolean }) {
  return (
    <div className="group overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:overflow-x-auto">
      <div
        className={`flex w-max animate-marquee-slow group-hover:[animation-play-state:paused] motion-reduce:animate-none ${
          reverse ? '[animation-direction:reverse]' : ''
        }`}
      >
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 gap-6 pr-6">
            {items.map((t, i) => (
              <TestimonialCard key={t.name} t={t} tilt={i % 2 === 0 ? '-rotate-1' : 'rotate-1'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Testimonials() {
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
        className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-50 via-white to-pink-50 py-20 ring-1 ring-slate-900/5 ring-inset [clip-path:inset(0_round_2rem)] sm:py-24"
        style={{ '--mx': '50%', '--my': '30%' } as CSSProperties}
      >
        {/* Drifting colour glows + dot grid + cursor glow. The clip-path above keeps
            the animated blurs inside the rounded corners (overflow alone leaks there). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-1/3 -left-1/4 h-[30rem] w-[30rem] animate-aurora rounded-full bg-sky-300/40 blur-3xl motion-reduce:animate-none" />
          <div
            className="absolute -right-1/4 -bottom-1/3 h-[30rem] w-[30rem] animate-aurora rounded-full bg-pink-300/40 blur-3xl motion-reduce:animate-none"
            style={{ animationDelay: '-6s', animationDuration: '22s' }}
          />
          <div
            className="absolute top-1/4 left-1/3 h-[22rem] w-[22rem] animate-aurora rounded-full bg-amber-200/50 blur-3xl motion-reduce:animate-none"
            style={{ animationDelay: '-12s', animationDuration: '26s' }}
          />
          <div
            className="absolute -top-1/4 right-1/4 h-[20rem] w-[20rem] animate-aurora rounded-full bg-violet-300/30 blur-3xl motion-reduce:animate-none"
            style={{ animationDelay: '-3s', animationDuration: '20s' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(15,23,42,0.06)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:22px_22px]" />
          <div className="absolute inset-0 bg-[radial-gradient(420px_circle_at_var(--mx)_var(--my),rgba(236,72,153,0.12),transparent_50%)]" />
        </div>

        <div className="mx-auto max-w-2xl px-6 text-center">
          <span className="text-sm font-semibold tracking-[0.2em] text-pink-500 uppercase">Testimonials</span>
          <h2 className="font-display mt-4 text-4xl text-slate-900 sm:text-5xl">Teams running on Agentis</h2>
          <p className="mt-4 text-lg text-slate-600">
            From ops to outbound, here's what changes when the work just gets done.
          </p>
        </div>

        <div className="mt-12 space-y-2">
          <CardRow items={testimonials} />
          <CardRow items={[...testimonials].reverse()} reverse />
        </div>
      </div>
    </section>
  )
}
