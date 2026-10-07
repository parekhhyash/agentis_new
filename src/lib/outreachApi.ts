import { authedFetch } from './backendApi'
import type { OutreachAction, OutreachResult } from './outreachTypes'
import type { CompanyContext } from './salesAgentApi'

export interface OutreachRunInput {
  prompt: string
  requestId: string
  companyContext?: CompanyContext
  senderName?: string | null
  leadRequestId?: string | null
}

export function runOutreach(input: OutreachRunInput, signal?: AbortSignal): Promise<OutreachResult> {
  return authedFetch<OutreachResult>('/sales-outreach/run', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      prompt: input.prompt,
      request_id: input.requestId,
      company_context: input.companyContext,
      sender_name: input.senderName,
      lead_request_id: input.leadRequestId,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  })
}

export type OutreachDecision = 'approve' | 'discard' | 'save'

export function decideOutreachAction(
  requestId: string,
  actionId: string,
  decision: OutreachDecision,
  edits: Record<string, unknown> = {},
): Promise<OutreachAction> {
  return authedFetch<OutreachAction>(`/sales-outreach/requests/${requestId}/actions/${actionId}`, {
    method: 'POST',
    body: JSON.stringify({ decision, edits }),
  })
}
