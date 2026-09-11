export default function CTA() {
  return (
    <section id="get-started" className="bg-black px-4 pt-24 sm:pt-32">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-16 text-center sm:px-16">
        <h2 className="font-display text-balance text-4xl text-white sm:text-5xl">
          Ready to put your company on autopilot?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-white/70">
          Start free. No credit card, no setup calls — describe your first
          task and watch Agentis take it from there.
        </p>
        <a
          href="#"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-[15px] font-semibold text-blue-500 transition-opacity hover:opacity-90"
        >
          Get started free
        </a>
      </div>

      <footer className="mx-auto mt-24 max-w-5xl border-t border-white/10 py-10">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <span className="font-display text-lg text-white">Agentis</span>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-white/60">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a
              href="#how-it-works"
              className="transition-colors hover:text-white"
            >
              How it works
            </a>
            <a
              href="#testimonials"
              className="transition-colors hover:text-white"
            >
              Testimonials
            </a>
            <a href="#faqs" className="transition-colors hover:text-white">
              FAQs
            </a>
          </div>
          <span className="text-sm text-white/40">
            © 2026 Agentis. All rights reserved.
          </span>
        </div>
      </footer>
    </section>
  )
}
