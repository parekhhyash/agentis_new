import { useState } from 'react'
import type { Tables } from '../../lib/database.types'
import { AGENT_LABELS } from '../../lib/agentTypes'
import type { LeadGenerationResult } from '../../lib/salesAgentTypes'
import { relativeTime } from '../../lib/relativeTime'
import LeadResultsPanel from './LeadResultsPanel'

type AgentRequest = Tables<'agent_requests'>

const STATUS_STYLES: Record<AgentRequest['status'], string> = {
  queued: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-sky-100 text-sky-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<AgentRequest['status'], string> = {
  queued: 'Queued',
  in_progress: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
}

function RequestRow({ request }: { request: AgentRequest }) {
  const [expanded, setExpanded] = useState(false)
  const hasResult = request.status === 'completed' && request.result != null
  const canExpand = hasResult || (request.status === 'failed' && request.error)

  return (
    <li>
      <div
        className={`flex items-center justify-between gap-4 px-5 py-4 ${canExpand ? 'cursor-pointer hover:bg-slate-50' : ''}`}
        onClick={() => canExpand && setExpanded((e) => !e)}
      >
        <div className="min-w-0">
          <p className="truncate text-[15px] text-slate-800">{request.prompt}</p>
          <p className="mt-1 text-xs text-slate-400">
            {AGENT_LABELS[request.agent_type]} &middot; {relativeTime(request.created_at)}
            {canExpand && <> &middot; {expanded ? 'Hide details' : 'View details'}</>}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[request.status]}`}
        >
          {STATUS_LABELS[request.status]}
        </span>
      </div>

      {expanded && hasResult && (
        <LeadResultsPanel result={request.result as unknown as LeadGenerationResult} />
      )}
      {expanded && request.status === 'failed' && request.error && (
        <div className="border-t border-slate-100 bg-red-50 p-4 text-sm text-red-700">
          {request.error}
        </div>
      )}
    </li>
  )
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
        <RequestRow key={request.id} request={request} />
      ))}
    </ul>
  )
}
