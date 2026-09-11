import heroBg from '../assets/hero-bg.png'

function Navbar() {
  const links = ['How it works', 'Showcases', 'Pricing', 'FAQs']

  return (
    <nav
      className="fixed top-6 left-1/2 z-20 flex w-[95%] max-w-3xl -translate-x-1/2 items-center justify-between gap-6 rounded-full border border-white/40 bg-white/25 px-3 py-2 pl-6 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-2xl"
    >
      <span className="font-display text-xl text-white">Agentis</span>

      <div className="hidden items-center gap-8 text-[15px] font-semibold text-white md:flex">
        {links.map((link) => (
          <a
            key={link}
            href="#"
            className="transition-colors hover:text-white/80"
          >
            {link}
          </a>
        ))}
      </div>

      <a
        href="#"
        className="rounded-full bg-white px-5 py-2.5 text-[15px] font-medium text-blue-500 transition-opacity hover:opacity-90"
      >
        Signup
      </a>
    </nav>
  )
}

function MonitorIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  )
}

function PromptBox() {
  return (
    <div className="w-full max-w-2xl rounded-2xl border border-black/5 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-5">
      <textarea
        rows={1}
        placeholder="Describe what you want to do..."
        className="w-full resize-none bg-transparent text-[17px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] font-medium text-slate-800 transition-colors hover:bg-slate-100"
        >
          <MonitorIcon />
          Sales &amp; Outreach
          <ChevronDownIcon />
        </button>

        <button
          type="button"
          aria-label="Submit"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-sky-400 text-sky-500 transition-colors hover:bg-sky-50"
        >
          <ArrowUpIcon />
        </button>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <Navbar />

      <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-24 pb-16">
        <h1 className="font-display text-center text-6xl leading-[1.1] text-white sm:text-7xl md:text-8xl">
          Agentis
        </h1>

        <p className="mt-6 max-w-2xl text-center text-lg text-white/85 sm:text-xl">
          Agentis lets you run company with AI
        </p>

        <div className="mt-10 w-full max-w-2xl">
          <PromptBox />
        </div>
      </main>
    </div>
  )
}
