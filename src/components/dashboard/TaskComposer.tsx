import { useState } from 'react'
import { AGENT_TYPES, type AgentType } from '../../lib/agentTypes'
import { ArrowUpIcon, ChevronDownIcon, MonitorIcon, StopIcon } from '../icons'

export default function TaskComposer({
  agentType,
  onAgentTypeChange,
  onSubmit,
  isRunning = false,
  onStop,
}: {
  agentType: AgentType
  onAgentTypeChange: (value: AgentType) => void
  onSubmit: (prompt: string) => Promise<void>
  isRunning?: boolean
  onStop?: () => void
}) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const selectedAgent = AGENT_TYPES.find((a) => a.value === agentType) ?? AGENT_TYPES[0]

  async function handleSubmit() {
    const prompt = value.trim()
    if (!prompt || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(prompt)
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl rounded-2xl border border-black/5 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)] sm:p-5">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        placeholder="Describe what you want to do..."
        className="w-full resize-none bg-transparent text-[17px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] font-medium text-slate-800 transition-colors hover:bg-slate-100"
          >
            <MonitorIcon />
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
                      onAgentTypeChange(agent.value)
                      setMenuOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                      agent.value === agentType ? 'text-sky-600' : 'text-slate-700'
                    }`}
                  >
                    <MonitorIcon className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{agent.label}</span>
                    {agent.value !== 'sales_outreach' && (
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

        {isRunning ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={onStop}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-red-400 text-red-500 transition-colors hover:bg-red-50"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Submit"
            onClick={handleSubmit}
            disabled={submitting || value.trim().length === 0}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-sky-400 text-sky-500 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUpIcon />
          </button>
        )}
      </div>
    </div>
  )
}
