const steps = [
  {
    number: '01',
    title: 'Describe the task',
    description:
      "Tell Agentis what you need in plain language, the same way you'd brief a teammate.",
  },
  {
    number: '02',
    title: 'The right agent takes it',
    description:
      'Agentis routes the job to a specialized agent with the context and tools to do it well.',
  },
  {
    number: '03',
    title: 'Review and ship',
    description:
      'Get finished work back for approval, tweak if needed, and publish — no back-and-forth.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-black px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-sky-400 uppercase">
          How it works
        </span>
        <h2 className="font-display mt-4 text-4xl text-white sm:text-5xl">
          From idea to done, in three steps
        </h2>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
        {steps.map((step) => (
          <div key={step.number} className="text-center sm:text-left">
            <span className="font-display text-5xl text-white/15">
              {step.number}
            </span>
            <h3 className="mt-4 text-xl font-semibold text-white">
              {step.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-white/60">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
