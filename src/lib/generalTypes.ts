import type { AgentType } from './agentTypes'

// Mirrors backend/agents/general/agent.py.
export interface GeneralResult {
  kind: 'general'
  reply: string
  route: 'none' | Extract<AgentType, 'lead_research' | 'sales_outreach' | 'data_reporting'>
  task: string
}

export function isGeneralResult(value: unknown): value is GeneralResult {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'general'
}
