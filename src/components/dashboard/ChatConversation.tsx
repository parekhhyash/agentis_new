import { AGENT_LABELS } from '../../lib/agentTypes'
import type { Tables } from '../../lib/database.types'
import type { CrmProviderStatus } from '../../lib/crm'
import { attachmentsOf, isDataReport } from '../../lib/dataTypes'
import { relativeTime } from '../../lib/relativeTime'
import { isGeneralResult } from '../../lib/generalTypes'
import { isOutreachResult, type OutreachAction } from '../../lib/outreachTypes'
import type { AgentProgress, AnyLeadResult } from '../../lib/salesAgentTypes'
import AgentProgressView from './AgentProgressView'
import GeneralReply from './GeneralReply'
import LeadResultsPanel from './LeadResultsPanel'
import OutreachResultsPanel from './OutreachResultsPanel'
import ReportPanel from './report/ReportPanel'
import { SheetIcon } from '../icons'

type AgentRequest = Tables<'agent_requests'>

// One turn of a chat: the message and the agent's answer. A turn the General
// agent handed off shows the hand-off instead of a user message.
export default function ChatConversation({
  request,
  handedOff = false,
  onOutreachActionChange,
  onResultChange,
  crms = [],
  onAddLeadsToCrm,
}: {
  request: AgentRequest
  handedOff?: boolean
  onOutreachActionChange?: (action: OutreachAction) => void
  onResultChange?: (result: unknown) => void
  // Connected CRMs, for "Add to HubSpot" on lead results.
  crms?: CrmProviderStatus[]
  onAddLeadsToCrm?: (crmName: string, count: number) => void
}) {
  const files = attachmentsOf(request.attachments)
  const fileChips = files.length > 0 && (
    <ul className={`flex flex-wrap gap-1.5 ${handedOff ? 'mt-2' : 'mb-2 justify-end'}`}>
      {files.map((file) => (
        <li
          key={file.id}
          className={`flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
            handedOff ? 'bg-slate-100 text-slate-600' : 'bg-white/15 text-white'
          }`}
        >
          <SheetIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{file.name}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="space-y-6">
      {handedOff ? (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3">
          <span className="mt-0.5 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-slate-600">
            General &rarr; {AGENT_LABELS[request.agent_type]}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-600">{request.prompt}</p>
            {fileChips}
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <div className="max-w-xl rounded-2xl rounded-tr-sm bg-sky-600 px-4 py-3 text-white">
            {fileChips}
            <p className="text-[15px] whitespace-pre-line">{request.prompt}</p>
            <p className="mt-1.5 text-xs text-sky-100">
              {AGENT_LABELS[request.agent_type]} &middot; {relativeTime(request.created_at)}
            </p>
          </div>
        </div>
      )}

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
            (isGeneralResult(request.result) ? (
              <GeneralReply
                result={request.result}
                requestId={request.id}
                onResultChange={(result) => onResultChange?.(result)}
              />
            ) : isDataReport(request.result) ? (
              <ReportPanel result={request.result} />
            ) : isOutreachResult(request.result) ? (
              <OutreachResultsPanel
                key={request.id}
                requestId={request.id}
                result={request.result}
                onActionChange={(action) => onOutreachActionChange?.(action)}
                onResultChange={(result) => onResultChange?.(result)}
              />
            ) : (
              <LeadResultsPanel
                result={request.result as unknown as AnyLeadResult}
                crms={crms.map((c) => c.name)}
                onAddToCrm={onAddLeadsToCrm}
              />
            ))}

          {request.status === 'failed' && (
            <p className="text-sm text-red-700">{request.error ?? 'Something went wrong.'}</p>
          )}
        </div>
      </div>
    </div>
  )
}
