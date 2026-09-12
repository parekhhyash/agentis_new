import { useState } from 'react'
import { AGENT_TYPES, type AgentType } from '../../lib/agentTypes'
import { ArrowUpIcon } from '../icons'

export default function TaskComposer({
  agentType,
  onAgentTypeChange,
  onSubmit,
}: {
  agentType: AgentType
  onAgentTypeChange: (value: AgentType) => void
  onSubmit: (prompt: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <textarea
        rows={2}
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <select
          value={agentType}
          onChange={(e) => onAgentTypeChange(e.target.value as AgentType)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-sky-500 focus:outline-none"
        >
          {AGENT_TYPES.map((agent) => (
            <option key={agent.value} value={agent.value}>
              {agent.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-label="Submit"
          onClick={handleSubmit}
          disabled={submitting || value.trim().length === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-sky-400 text-sky-500 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUpIcon />
        </button>
      </div>
    </div>
  )
}
