function EmailMockup() {
  return (
    <div className="pointer-events-none absolute -right-4 -bottom-6 w-48 rotate-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:w-56">
      <div className="h-2 w-3/4 rounded-full bg-slate-200" />
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100" />
      <div className="mt-2 h-2 w-5/6 rounded-full bg-slate-100" />
      <div className="mt-4 inline-block rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white">
        Send
      </div>
    </div>
  )
}

function BrowserMockup() {
  return (
    <div className="pointer-events-none absolute -right-4 -bottom-6 w-48 -rotate-2 overflow-hidden rounded-xl border border-white/30 bg-white shadow-xl sm:w-60">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
      </div>
      <div className="h-16 bg-gradient-to-br from-sky-200 via-sky-100 to-white" />
    </div>
  )
}

function ChatMockup() {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex justify-start">
        <div className="max-w-[75%] rounded-lg rounded-bl-sm bg-white px-3 py-1.5 text-[11px] text-slate-600 shadow-sm">
          My order hasn't arrived yet
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <div className="max-w-[75%] rounded-lg rounded-br-sm bg-sky-600 px-3 py-1.5 text-[11px] text-white shadow-sm">
          Found it — out for delivery today
        </div>
      </div>
    </div>
  )
}

function Sparkline() {
  const bars = [40, 65, 45, 80, 60, 95, 75]
  return (
    <div className="mt-6 flex h-16 items-end gap-2">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-3 rounded-full bg-white/30"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

export default function Features() {
  return (
    <section id="features" className="bg-white px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-sky-600 uppercase">
          Agents
        </span>
        <h2 className="font-display mt-4 text-4xl text-slate-900 sm:text-5xl">
          One team, every function
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">
          Each agent specializes in a single job, the way a great hire would
          — and they all report to you.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Lead Research — white, wide, email mockup */}
        <div className="relative col-span-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 pb-24 shadow-sm sm:col-span-2">
          <h3 className="max-w-[60%] text-xl font-semibold text-slate-900">
            Lead Research
          </h3>
          <p className="mt-2 max-w-[60%] text-[15px] leading-relaxed text-slate-600">
            Find and qualify real companies as sales leads — your pipeline
            keeps filling while you sleep.
          </p>
          <EmailMockup />
        </div>

        {/* Sales & Outreach — solid sky, wide, browser mockup */}
        <div className="relative col-span-1 overflow-hidden rounded-2xl bg-sky-600 p-7 pb-24 sm:col-span-2">
          <h3 className="max-w-[60%] text-xl font-semibold text-white">
            Sales &amp; Outreach
          </h3>
          <p className="mt-2 max-w-[60%] text-[15px] leading-relaxed text-white/80">
            Draft sequences, follow up, and book meetings with the leads
            already qualified for you.
          </p>
          <BrowserMockup />
        </div>

        {/* Content & Copy — white, narrow, decorative blob */}
        <div className="relative col-span-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div
            className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full bg-gradient-to-br from-sky-200 to-sky-50 blur-sm"
            aria-hidden
          />
          <h3 className="relative text-lg font-semibold text-slate-900">
            Content &amp; Copy
          </h3>
          <p className="relative mt-2 text-[15px] leading-relaxed text-slate-600">
            Blog posts, ad copy, and social captions that sound like your
            brand, not a template.
          </p>
        </div>

        {/* Customer Support — white, narrow, chat mockup framed inside */}
        <div className="col-span-1 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Customer Support
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            Resolve common tickets instantly and route the rest to your team.
          </p>
          <ChatMockup />
        </div>

        {/* Data & Reporting — solid sky, wide, sparkline + stat */}
        <div className="relative col-span-1 overflow-hidden rounded-2xl bg-sky-600 p-7 sm:col-span-2">
          <h3 className="text-xl font-semibold text-white">
            Data &amp; Reporting
          </h3>
          <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-white/80">
            Turn raw numbers into a clean weekly report, no spreadsheet
            wrangling required.
          </p>
          <div className="mt-4 flex items-end justify-between">
            <span className="font-display text-4xl text-white">+40%</span>
            <Sparkline />
          </div>
        </div>

        {/* Operations — white, full width banner */}
        <div
          className="relative col-span-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 sm:col-span-2 lg:col-span-4"
          style={{
            backgroundImage:
              'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            backgroundPosition: 'right -20px top -20px',
          }}
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Operations
              </h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-slate-600">
                Automate the repetitive back-office work that quietly eats up
                your team's week.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
              Always on
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
