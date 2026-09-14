import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import SectionLink from './SectionLink'

export default function CTA() {
  const { user } = useAuth()

  return (
    <section id="get-started" className="bg-white px-4 pt-24 sm:pt-32">
      <div className="mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-sky-50 px-8 py-16 text-center sm:px-16">
        <h2 className="font-display text-balance text-4xl text-slate-900 sm:text-5xl">
          Ready to put your company on autopilot?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-slate-600">
          Start free. No credit card, no setup calls — describe your first
          task and watch Agentis take it from there.
        </p>
        <Link
          to={user ? '/dashboard' : '/signup'}
          className="mt-8 inline-flex items-center justify-center rounded-full bg-sky-600 px-7 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-sky-700"
        >
          {user ? 'Go to dashboard' : 'Get started free'}
        </Link>
      </div>

      <footer className="mx-auto mt-24 max-w-5xl border-t border-slate-200 py-10">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <span className="font-display text-lg text-slate-900">Agentis</span>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-500">
            <SectionLink
              id="features"
              className="transition-colors hover:text-slate-900"
            >
              Features
            </SectionLink>
            <SectionLink
              id="how-it-works"
              className="transition-colors hover:text-slate-900"
            >
              How it works
            </SectionLink>
            <SectionLink
              id="testimonials"
              className="transition-colors hover:text-slate-900"
            >
              Testimonials
            </SectionLink>
            <SectionLink
              id="faqs"
              className="transition-colors hover:text-slate-900"
            >
              FAQs
            </SectionLink>
          </div>
          <span className="text-sm text-slate-400">
            © 2026 Agentis. All rights reserved.
          </span>
        </div>
      </footer>
    </section>
  )
}
