import { QuoteIcon } from './icons'

const testimonials = [
  {
    quote:
      'We replaced three weekly ops tasks with one Agentis workflow. It just runs now.',
    name: 'Priya Nair',
    role: 'COO, Fernway Logistics',
    initials: 'PN',
  },
  {
    quote:
      'Our outbound sequences used to take a full day to write. Agentis drafts them before our morning standup.',
    name: 'Marcus Lee',
    role: 'Head of Sales, Northloop',
    initials: 'ML',
  },
  {
    quote:
      'I described the landing page I wanted and had a working version to review in under ten minutes.',
    name: 'Sofia Reyes',
    role: 'Founder, Reyes Studio',
    initials: 'SR',
  },
]

export default function Testimonials() {
  return (
    <section id="testimonials" className="bg-white px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-sky-600 uppercase">
          Testimonials
        </span>
        <h2 className="font-display mt-4 text-4xl text-slate-900 sm:text-5xl">
          Teams running on Agentis
        </h2>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-3">
        {testimonials.map((t) => (
          <figure
            key={t.name}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
          >
            <QuoteIcon className="text-sky-200" />
            <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-slate-700">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                {t.initials}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {t.name}
                </span>
                <span className="block text-sm text-slate-500">{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
