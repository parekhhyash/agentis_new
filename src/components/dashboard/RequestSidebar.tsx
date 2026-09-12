import { AGENT_LABELS } from '../../lib/agentTypes'
import type { Tables } from '../../lib/database.types'
import { relativeTime } from '../../lib/relativeTime'

type AgentRequest = Tables<'agent_requests'>

const STATUS_DOT: Record<AgentRequest['status'], string> = {
  queued: 'bg-slate-300',
  in_progress: 'bg-sky-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
}

export default function RequestSidebar({
  requests,
  loading,
  selectedId,
  onSelect,
}: {
  requests: AgentRequest[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (loading) {
    return <p className="px-3 py-6 text-center text-sm text-slate-400">Loading...</p>
  }

  if (requests.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-slate-400">
        No requests yet. Start a conversation to see it here.
      </p>
    )
  }

  return (
    <ul className="space-y-1">
      {requests.map((request) => {
        const isSelected = request.id === selectedId
        return (
          <li key={request.id}>
            <button
              type="button"
              onClick={() => onSelect(request.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                isSelected ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[request.status]}`}
                />
                <p className="truncate text-sm text-slate-800">{request.prompt}</p>
              </div>
              <p className="mt-1 pl-3.5 text-xs text-slate-400">
                {AGENT_LABELS[request.agent_type]} &middot; {relativeTime(request.created_at)}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
