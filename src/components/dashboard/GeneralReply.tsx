import { AGENT_TYPES } from '../../lib/agentTypes'
import type { GeneralResult } from '../../lib/generalTypes'
import CrmResultPanel from './CrmResultPanel'
import RichText from './RichText'

export default function GeneralReply({
  result,
  requestId,
  onResultChange,
}: {
  result: GeneralResult
  requestId: string
  onResultChange?: (result: GeneralResult) => void
}) {
  const agent = result.route !== 'none' ? AGENT_TYPES.find((a) => a.value === result.route) : null
  return (
    <div>
      <RichText text={result.reply} />
      {result.crm && (
        <CrmResultPanel requestId={requestId} crm={result.crm} onChange={(crm) => onResultChange?.({ ...result, crm })} />
      )}
      {agent && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pr-3 pl-1 text-xs font-medium text-slate-600">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue text-white">
            <agent.icon className="h-3 w-3" />
          </span>
          Handed to {agent.label}
        </div>
      )}
    </div>
  )
}
