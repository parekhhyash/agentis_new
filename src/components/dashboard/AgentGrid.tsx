import { AGENT_TYPES, type AgentType } from '../../lib/agentTypes'

export default function AgentGrid({
  selected,
  onSelect,
}: {
  selected: AgentType
  onSelect: (value: AgentType) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {AGENT_TYPES.map((agent) => {
        const isSelected = agent.value === selected
        return (
          <button
            key={agent.value}
            type="button"
            onClick={() => onSelect(agent.value)}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              isSelected
                ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500'
                : 'border-slate-200 bg-white hover:border-sky-300'
            }`}
          >
            <h3 className="text-[15px] font-semibold text-slate-900">
              {agent.label}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{agent.description}</p>
          </button>
        )
      })}
    </div>
  )
}
