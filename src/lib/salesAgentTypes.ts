export interface Evidence {
  claim: string
  source_url: string
  status: 'verified' | 'likely'
}

export interface LeadContact {
  name: string
  title: string
  company: string
  linkedin_url: string | null
  email: string | null
  email_verified: boolean
  source_url: string
}

export interface Qualification {
  icp_match: boolean
  industry_match: boolean | null
  geography_match: boolean | null
  size_match: 'verified' | 'likely' | 'unknown' | 'mismatch'
  use_case_match: boolean | null
  growth_signal: boolean | null
  contact_found: boolean
}

export interface ResearchLead {
  company_name: string
  website: string
  industry: string | null
  location: string | null
  employee_count: string | null
  qualification: string
  why_relevant: string
  relevant_signals: string[]
  qualification_detail: Qualification
  evidence: Evidence[]
  contacts: LeadContact[]
  company_emails: string[]
  contact_page: string | null
  sources: string[]
}

export interface ICPSummary {
  summary: string
  industries: string[]
  geographies: string[]
  company_size: string | null
  target_roles: string[]
  signals: string[]
}

export interface LeadResearchResult {
  query: string
  icp: ICPSummary
  requested_leads: number
  leads_found: number
  leads: ResearchLead[]
  notes: string | null
}

// Shape produced by the previous agent - still stored on older requests.
export interface LegacyLead {
  company_name: string
  website: string | null
  industry: string | null
  description: string | null
  location: string | null
  company_size: string | null
  potential_pain_point: string | null
  why_good_fit: string | null
  business_email: string | null
  contact_page: string | null
  qualification_score: number
  reasoning: string
  sources: string[]
  inferred_fields: string[]
}

export interface LegacyLeadGenerationResult {
  query: string
  criteria: { industry: string | null; geography: string | null }
  leads_found: number
  leads: LegacyLead[]
  notes: string | null
}

export type AnyLeadResult = LeadResearchResult | LegacyLeadGenerationResult

export function isLeadResearchResult(result: AnyLeadResult): result is LeadResearchResult {
  return 'icp' in result
}

export interface AgentProgressStep {
  label: string
  at: string
}

export interface AgentProgress {
  current_step: string | null
  steps: AgentProgressStep[]
}
