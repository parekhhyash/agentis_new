import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import heroBg from '../assets/hero-bg.png'
import { AGENT_TYPES, type AgentType } from '../lib/agentTypes'
import { useAuth } from '../lib/AuthContext'
import { ArrowUpIcon, ChevronDownIcon } from './icons'
import SectionLink from './SectionLink'

const navLinks = [
  { label: 'Features', id: 'features' },
  { label: 'How it works', id: 'how-it-works' },
  { label: 'Testimonials', id: 'testimonials' },
  { label: 'FAQs', id: 'faqs' },
]

function Navbar({ dark }: { dark: boolean }) {
  const { user } = useAuth()

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
        to={user ? '/dashboard' : '/signup'}
        className="rounded-full bg-white px-5 py-2.5 text-[15px] font-medium text-blue-500 shadow-sm transition-opacity hover:opacity-90"
      >
        {user ? 'Dashboard' : 'Get started'}
      </Link>
    </nav>
  )
}

// Grows the composer with content, but caps it so a very long paste doesn't
// push the rest of the page around - it scrolls internally past this. Kept
// in sync with the dashboard's TaskComposer.
const MAX_TEXTAREA_HEIGHT = 200

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
}

function PromptBox() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [value, setValue] = useState('')
  const [agentType, setAgentType] = useState<AgentType>('lead_research')
  const [menuOpen, setMenuOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedAgent = AGENT_TYPES.find((a) => a.value === agentType) ?? AGENT_TYPES[0]
  const SelectedIcon = selectedAgent.icon

  const submit = () => {
    if (value.trim().length === 0) return
    navigate(user ? '/dashboard' : '/signup')
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-black/5 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-5">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          autoResize(e.target)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Describe what you want to do..."
        style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
        className="w-full resize-none overflow-y-auto bg-transparent text-[17px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] font-medium text-slate-800 transition-colors hover:bg-slate-100"
          >
            <SelectedIcon />
            {selectedAgent.label}
            <ChevronDownIcon />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                {AGENT_TYPES.map((agent) => (
                  <button
                    key={agent.value}
                    type="button"
                    onClick={() => {
                      setAgentType(agent.value)
                      setMenuOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                      agent.value === agentType ? 'text-sky-600' : 'text-slate-700'
                    }`}
                  >
                    <agent.icon className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{agent.label}</span>
                    {agent.value !== 'lead_research' && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        Soon
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Submit"
          onClick={submit}
          disabled={value.trim().length === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-sky-400 text-sky-500 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
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
