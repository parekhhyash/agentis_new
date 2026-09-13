export interface SearchCriteria {
  industry: string | null
  geography: string | null
  company_stage: string | null
  use_case: string | null
  num_leads_requested: number
  other_criteria: string[]
}

export interface Lead {
  company_name: string
  website: string | null
  industry: string | null
  description: string | null
  location: string | null
  company_size: string | null
  relevant_product_service: string | null
  potential_pain_point: string | null
  why_good_fit: string | null
  business_email: string | null
  contact_page: string | null
  qualification_score: number
  reasoning: string
  sources: string[]
  inferred_fields: string[]
}

export interface LeadGenerationResult {
  query: string
  criteria: SearchCriteria
  leads_found: number
  leads: Lead[]
  notes: string | null
}

export interface AgentProgressStep {
  label: string
  at: string
}

export interface AgentProgress {
  current_step: string | null
  steps: AgentProgressStep[]
}
