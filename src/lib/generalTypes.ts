import type { AgentType } from './agentTypes'
import type { CrmResult } from './crm'

// Mirrors backend/agents/general/agent.py.
export interface GeneralResult {
  kind: 'general'
  reply: string
  route: 'none' | Extract<AgentType, 'lead_research' | 'sales_outreach' | 'data_reporting'>
  task: string
  // Present when the answer came from the user's CRM.
  crm?: CrmResult | null
}

export function isGeneralResult(value: unknown): value is GeneralResult {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'general'
}
