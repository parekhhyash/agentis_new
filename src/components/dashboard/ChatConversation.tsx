import { AGENT_LABELS } from '../../lib/agentTypes'
import type { Tables } from '../../lib/database.types'
import { relativeTime } from '../../lib/relativeTime'
import { isOutreachResult, type OutreachAction } from '../../lib/outreachTypes'
import type { AgentProgress, AnyLeadResult } from '../../lib/salesAgentTypes'
import AgentProgressView from './AgentProgressView'
import LeadResultsPanel from './LeadResultsPanel'
import OutreachResultsPanel from './OutreachResultsPanel'

type AgentRequest = Tables<'agent_requests'>

export default function ChatConversation({
  request,
  onOutreachActionChange,
}: {
  request: AgentRequest
  onOutreachActionChange?: (action: OutreachAction) => void
}) {
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
        <div
          className={`w-full rounded-2xl rounded-tl-sm border border-slate-200 bg-surface px-4 py-3 ${
            request.status === 'completed' ? '' : 'max-w-2xl'
          }`}
        >
          {request.status === 'queued' && <p className="text-sm text-slate-500">Queued&hellip;</p>}

          {request.status === 'in_progress' && (
            <AgentProgressView
              agentType={request.agent_type}
              startedAt={request.started_at ?? request.created_at}
              progress={request.progress as unknown as AgentProgress | null}
            />
          )}

          {request.status === 'completed' &&
            request.result != null &&
            (isOutreachResult(request.result) ? (
              <OutreachResultsPanel
                key={request.id}
                requestId={request.id}
                result={request.result}
                onActionChange={(action) => onOutreachActionChange?.(action)}
              />
            ) : (
              <LeadResultsPanel result={request.result as unknown as AnyLeadResult} />
            ))}

          {request.status === 'failed' && (
            <p className="text-sm text-red-700">{request.error ?? 'Something went wrong.'}</p>
          )}
        </div>
      </div>
    </div>
  )
}
