function EmailMockup() {
  return (
    <div className="pointer-events-none absolute -right-4 -bottom-6 w-48 rotate-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:w-56">
      <div className="h-2 w-3/4 rounded-full bg-slate-200" />
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100" />
      <div className="mt-2 h-2 w-5/6 rounded-full bg-slate-100" />
      <div className="mt-4 inline-block rounded-full bg-brand-blue px-3 py-1 text-[11px] font-semibold text-white">
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
      <div className="h-16 bg-brand-sky/25" />
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
        <div className="max-w-[75%] rounded-lg rounded-br-sm bg-brand-blue px-3 py-1.5 text-[11px] text-white shadow-sm">
          Found it — out for delivery today
        </div>
      </div>
    </div>
  )
}

// Points (0-100) for the report's chart, drawn into a 200x64 viewBox.
const REPORT_POINTS = [18, 30, 24, 42, 36, 58, 52, 74]

function ReportMockup() {
  const xy = REPORT_POINTS.map((p, i) => [(i * 200) / (REPORT_POINTS.length - 1), 60 - (p / 100) * 52] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [lastX, lastY] = xy[xy.length - 1]
  return (
    <div className="pointer-events-none absolute -right-4 -bottom-6 w-60 rotate-2 rounded-xl border border-white/40 bg-white p-4 shadow-xl sm:w-72">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-900">Weekly report</span>
        <span className="rounded-full bg-brand-pink/40 px-2 py-0.5 text-[10px] font-medium text-slate-700">
          Mon 9:00
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-3xl text-slate-900">+40%</span>
        <span className="text-[11px] text-slate-500">pipeline vs last week</span>
      </div>
      <svg viewBox="0 0 200 64" className="mt-2 h-auto w-full" aria-hidden="true">
        <path d={`${line} L200 64 L0 64 Z`} className="fill-brand-pink/50" />
        <path d={line} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-pink-600" />
        <circle cx={lastX} cy={lastY} r="3.5" className="fill-pink-600" />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Leads', '128'],
          ['Replies', '34'],
          ['Meetings', '9'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-xs font-semibold text-slate-900">{value}</div>
            <div className="text-[9px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Features() {
  return (
    <section id="features" className="relative z-10 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-brand-blue uppercase">
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

      <div className="mx-auto mt-16 grid max-w-[78rem] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Sales & Outreach — solid violet, wide, browser mockup */}
        <div className="relative col-span-1 overflow-hidden rounded-2xl bg-brand-violet p-7 pb-24 sm:col-span-2">
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
            className="pointer-events-none absolute -top-6 -right-6 h-28 w-28 rounded-full bg-brand-yellow/40 blur-sm"
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

        {/* Data & Reporting — deep pink (white text stays readable), wide, report mockup */}
        <div className="relative col-span-1 min-h-80 overflow-hidden rounded-2xl bg-pink-600 p-7 pb-56 sm:col-span-2 sm:pb-7">
          <h3 className="text-xl font-semibold text-white">
            Data &amp; Reporting
          </h3>
          <p className="mt-2 max-w-[55%] text-[15px] leading-relaxed text-white/85">
            Turn raw numbers into a clean weekly report, no spreadsheet
            wrangling required.
          </p>
          <ReportMockup />
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
            <span className="shrink-0 rounded-full bg-brand-yellow px-4 py-2 text-sm font-semibold text-slate-900">
              Always on
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
