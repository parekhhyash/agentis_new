import type { Tables } from '../../lib/database.types'
import { AGENT_LABELS } from '../../lib/agentTypes'
import { relativeTime } from '../../lib/relativeTime'

type AgentRequest = Tables<'agent_requests'>

const STATUS_STYLES: Record<AgentRequest['status'], string> = {
  queued: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-sky-100 text-sky-700',
  completed: 'bg-green-100 text-green-700',
}

const STATUS_LABELS: Record<AgentRequest['status'], string> = {
  queued: 'Queued',
  in_progress: 'In progress',
  completed: 'Completed',
}

export default function RequestHistory({
  requests,
  loading,
}: {
  requests: AgentRequest[]
  loading: boolean
}) {
  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Loading your requests...
      </p>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
        <p className="text-sm text-slate-500">
          No requests yet. Describe a task above to send it to an agent.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {requests.map((request) => (
        <li
          key={request.id}
          className="flex items-center justify-between gap-4 px-5 py-4"
        >
          <div className="min-w-0">
            <p className="truncate text-[15px] text-slate-800">
              {request.prompt}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {AGENT_LABELS[request.agent_type]} &middot;{' '}
              {relativeTime(request.created_at)}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[request.status]}`}
          >
            {STATUS_LABELS[request.status]}
          </span>
        </li>
      ))}
    </ul>
  )
}
