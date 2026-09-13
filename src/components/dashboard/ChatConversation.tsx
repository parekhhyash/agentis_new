import { AGENT_LABELS } from '../../lib/agentTypes'
import type { Tables } from '../../lib/database.types'
import { relativeTime } from '../../lib/relativeTime'
import type { AgentProgress, LeadGenerationResult } from '../../lib/salesAgentTypes'
import AgentProgressView from './AgentProgressView'
import LeadResultsPanel from './LeadResultsPanel'

type AgentRequest = Tables<'agent_requests'>

export default function ChatConversation({ request }: { request: AgentRequest }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="max-w-xl rounded-2xl rounded-tr-sm bg-sky-600 px-4 py-3 text-white">
          <p className="text-[15px]">{request.prompt}</p>
          <p className="mt-1.5 text-xs text-sky-100">
            {AGENT_LABELS[request.agent_type]} &middot; {relativeTime(request.created_at)}
          </p>
        </div>
      </div>

      <div className="flex justify-start">
        <div className="w-full max-w-2xl rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3">
          {request.status === 'queued' && <p className="text-sm text-slate-500">Queued&hellip;</p>}

          {request.status === 'in_progress' && (
            <AgentProgressView
              startedAt={request.started_at ?? request.created_at}
              progress={request.progress as unknown as AgentProgress | null}
            />
          )}

          {request.status === 'completed' && request.result != null && (
            <LeadResultsPanel result={request.result as unknown as LeadGenerationResult} />
          )}

          {request.status === 'failed' && (
            <p className="text-sm text-red-700">{request.error ?? 'Something went wrong.'}</p>
          )}
        </div>
      </div>
    </div>
  )
}
