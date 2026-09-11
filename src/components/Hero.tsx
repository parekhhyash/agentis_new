import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import heroBg from '../assets/hero-bg.png'
import { ArrowUpIcon, ChevronDownIcon, MonitorIcon } from './icons'
import SectionLink from './SectionLink'

const navLinks = [
  { label: 'Features', id: 'features' },
  { label: 'How it works', id: 'how-it-works' },
  { label: 'Testimonials', id: 'testimonials' },
  { label: 'FAQs', id: 'faqs' },
]

function Navbar({ dark }: { dark: boolean }) {
  return (
    <nav
      className={`fixed top-6 left-1/2 z-20 flex w-[95%] max-w-3xl -translate-x-1/2 items-center justify-between gap-6 rounded-full border px-3 py-2 pl-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl transition-colors duration-300 ${
        dark
          ? 'border-slate-200 bg-white/80'
          : 'border-white/40 bg-white/25'
      }`}
    >
      <span
        className={`font-display text-xl transition-colors duration-300 ${dark ? 'text-slate-900' : 'text-white'}`}
      >
        Agentis
      </span>

      <div
        className={`hidden items-center gap-8 text-[15px] font-semibold transition-colors duration-300 md:flex ${
          dark ? 'text-slate-700' : 'text-white'
        }`}
      >
        {navLinks.map((link) => (
          <SectionLink
            key={link.label}
            id={link.id}
            className={`transition-colors ${dark ? 'hover:text-slate-950' : 'hover:text-white/80'}`}
          >
            {link.label}
          </SectionLink>
        ))}
      </div>

      <Link
        to="/signup"
        className="rounded-full bg-white px-5 py-2.5 text-[15px] font-medium text-blue-500 shadow-sm transition-opacity hover:opacity-90"
      >
        Get started
      </Link>
    </nav>
  )
}

function PromptBox() {
  const [value, setValue] = useState('')
  const navigate = useNavigate()

  const submit = () => {
    if (value.trim().length === 0) return
    navigate('/signup')
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-black/5 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-5">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
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
          onClick={submit}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-sky-400 text-sky-500 transition-colors hover:bg-sky-50"
        >
          <ArrowUpIcon />
        </button>
      </div>
    </div>
  )
}

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrolledPastHero, setScrolledPastHero] = useState(false)

  useEffect(() => {
    const el = heroRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setScrolledPastHero(!entry.isIntersecting),
      { rootMargin: '-88px 0px 0px 0px', threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={heroRef}
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <Navbar dark={scrolledPastHero} />

      <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-24 pb-16">
        <h1 className="font-display text-center text-6xl leading-[1.1] text-white sm:text-7xl 2xl:text-8xl">
          Agentis
        </h1>

        <p className="mt-3 max-w-2xl text-center text-lg font-medium text-white/85 sm:text-xl">
          Turn sales, marketing, design, finance, and operations into
          AI-powered agents.
        </p>

        <div className="mt-10 w-full max-w-2xl">
          <PromptBox />
        </div>
      </main>
    </div>
  )
}
