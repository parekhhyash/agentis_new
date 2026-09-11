const stats = [
  { value: '12,000+', label: 'tasks completed autonomously' },
  { value: '40%', label: 'average time saved per team' },
  { value: '24/7', label: 'agents on the clock' },
]

export default function About() {
  return (
    <section id="about" className="bg-white px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-sky-600 uppercase">
          About Agentis
        </span>
        <h2 className="font-display mt-4 text-balance text-4xl text-slate-900 sm:text-5xl">
          A workforce of AI agents, built into your company
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">
          Agentis turns plain-language instructions into finished work.
          Describe the outcome you need — a sales sequence, a landing page, a
          support reply — and a specialized agent picks it up, does the work,
          and hands it back for your review. No hiring, no onboarding, no
          waiting.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-10 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="font-display text-4xl text-slate-900 sm:text-5xl">
              {stat.value}
            </div>
            <p className="mt-2 text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
