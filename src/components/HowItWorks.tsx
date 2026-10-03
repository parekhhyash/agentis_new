import type { ReactNode } from 'react'

import AgentCluster from './AgentCluster'

function PromptVisual() {
  return (
    <div className="w-[82%] max-w-72 rounded-2xl bg-surface p-4 shadow-lg ring-1 shadow-slate-900/5 ring-slate-200">
      <p className="text-[13px] leading-relaxed text-slate-700">
        Find 20 D2C skincare brands in India and draft an intro for each
        <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-brand-blue align-middle" />
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          Lead research
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-white">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  )
}

const PILLS = 24

function RoutingVisual() {
  return (
    <div className="relative flex h-[84%] items-center justify-center">
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="h-full animate-[spin_14s_linear_infinite] motion-reduce:animate-none"
      >
        {Array.from({ length: PILLS }, (_, i) => (
          <rect
            key={i}
            x="95"
            y="8"
            width="10"
            height="30"
            rx="5"
            transform={`rotate(${(360 / PILLS) * i} 100 100)`}
            className="fill-brand-violet"
            style={{ opacity: 0.2 + 0.8 * (i / (PILLS - 1)) }}
          />
        ))}
      </svg>
      <span className="absolute inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-md ring-1 ring-slate-200">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-violet" />
        Lead research
      </span>
    </div>
  )
}

function ReviewVisual() {
  return (
    <div className="w-[76%] max-w-64 rounded-2xl bg-surface p-4 shadow-lg ring-1 shadow-slate-900/5 ring-slate-200">
      <div className="h-2 w-2/3 rounded-full bg-slate-200" />
      <div className="mt-2.5 h-2 w-full rounded-full bg-slate-100" />
      <div className="mt-2 h-2 w-5/6 rounded-full bg-slate-100" />
      <div className="mt-2 h-2 w-3/4 rounded-full bg-slate-100" />
      <div className="mt-5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-violet px-3 py-1.5 text-[11px] font-medium text-white">
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-brand-yellow" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Ready to ship
        </span>
        <span className="text-[11px] font-medium text-brand-violet dark:text-[#a98bff]">Approve</span>
      </div>
    </div>
  )
}

const steps: { number: string; title: string; description: string; visual: ReactNode }[] = [
  {
    number: '01',
    title: 'Describe the task',
    description:
      "Tell Agentis what you need in plain language, the same way you'd brief a teammate.",
    visual: <PromptVisual />,
  },
  {
    number: '02',
    title: 'The right agent takes it',
    description:
      'Agentis routes the job to a specialized agent with the context and tools to do it well.',
    visual: <RoutingVisual />,
  },
  {
    number: '03',
    title: 'Review and ship',
    description:
      'Get finished work back for approval, tweak if needed, and publish. No back-and-forth.',
    visual: <ReviewVisual />,
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-page px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-brand-blue uppercase">
          How it works
        </span>
        <h2 className="font-display mt-4 text-4xl text-slate-900 sm:text-5xl">
          From idea to done, in three steps
        </h2>
      </div>

      <div className="mx-auto mt-16 grid max-w-[78rem] min-[1680px]:max-w-[86rem] grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-6 lg:gap-10">
        {steps.map((step) => (
          <div key={step.number}>
            <div className="flex aspect-[10/9] items-center justify-center rounded-3xl bg-zinc-100">
              {step.visual}
            </div>
            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-2xl text-slate-300">{step.number}</span>
              <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{step.description}</p>
          </div>
        ))}
      </div>

      <AgentCluster />
    </section>
  )
}
