// Shared "create a request, then fire its agent" logic - used by both the
// dashboard composer and the landing page's Hero prompt box, since a
// logged-in visitor can now kick off a real run straight from Hero before
// ever mounting DashboardPage.
//
// The abort-controller registry is a module-level singleton (not a
// component-local useRef) specifically so a run started from one mounted
// component (Hero, about to unmount on navigation) can still be stopped
// later from another (DashboardPage, mounted fresh after that navigation).

import type { AgentType } from './agentTypes'
import type { Json, Tables } from './database.types'
import {
  cancelLeadsGeneration,
  generateLeads,
  SalesAgentApiError,
  type CompanyContext,
} from './salesAgentApi'
import { supabase } from './supabase'

type AgentRequest = Tables<'agent_requests'>

const abortControllers = new Map<string, AbortController>()

export async function createAgentRequest(
  userId: string,
  agentType: AgentType,
  prompt: string,
): Promise<AgentRequest | null> {
  const { data, error } = await supabase
    .from('agent_requests')
    .insert({ user_id: userId, agent_type: agentType, prompt })
    .select()
    .single()

  return error || !data ? null : data
}

// Fire-and-forget: a real run takes minutes, so callers shouldn't await
// this before moving on. Status updates are written to Supabase directly
// (the backend also does this server-side - see request_store.py - so a
// caller doesn't strictly need `onUpdate`, but it lets an already-mounted
// list view like DashboardPage reflect the change instantly instead of
// waiting for its next poll).
export async function runLeadResearchAgent(
  requestId: string,
  prompt: string,
  companyContext: CompanyContext | undefined,
  onUpdate?: (patch: Partial<AgentRequest>) => void,
): Promise<void> {
  const startedAt = new Date().toISOString()
  await supabase
    .from('agent_requests')
    .update({ status: 'in_progress', started_at: startedAt })
    .eq('id', requestId)
  onUpdate?.({ status: 'in_progress', started_at: startedAt })

  const controller = new AbortController()
  abortControllers.set(requestId, controller)

  try {
    const result = await generateLeads(prompt, requestId, companyContext, controller.signal)
    await supabase
      .from('agent_requests')
      .update({ status: 'completed', result: result as unknown as Json })
      .eq('id', requestId)
    onUpdate?.({ status: 'completed', result: result as unknown as Json })
  } catch (err) {
    const message =
      err instanceof SalesAgentApiError ? err.message : 'Unexpected error running the agent.'
    await supabase
      .from('agent_requests')
      .update({ status: 'failed', error: message })
      .eq('id', requestId)
    onUpdate?.({ status: 'failed', error: message })
  } finally {
    abortControllers.delete(requestId)
  }
}

export function stopAgentRun(requestId: string) {
  abortControllers.get(requestId)?.abort()
  void cancelLeadsGeneration(requestId)
}
