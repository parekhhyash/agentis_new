import {
  ChartIcon,
  GearIcon,
  HeadsetIcon,
  MegaphoneIcon,
  MonitorIcon,
  PenIcon,
} from './icons'

const features = [
  {
    icon: MegaphoneIcon,
    title: 'Sales & Outreach',
    description:
      'Draft sequences, qualify leads, and book meetings — your pipeline keeps moving while you sleep.',
  },
  {
    icon: MonitorIcon,
    title: 'Web Design',
    description:
      'Hand off a brief and get a production-ready page, styled and responsive, in minutes.',
  },
  {
    icon: PenIcon,
    title: 'Content & Copy',
    description:
      'Blog posts, ad copy, and social captions that sound like your brand, not a template.',
  },
  {
    icon: HeadsetIcon,
    title: 'Customer Support',
    description:
      'Resolve common tickets instantly and route the rest to your team with full context.',
  },
  {
    icon: ChartIcon,
    title: 'Data & Reporting',
    description:
      'Turn raw numbers into a clean weekly report, no spreadsheet wrangling required.',
  },
  {
    icon: GearIcon,
    title: 'Operations',
    description:
      "Automate the repetitive back-office work that quietly eats up your team's week.",
  },
]

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

      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 transition-colors group-hover:bg-sky-100">
              <Icon />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">
              {title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
