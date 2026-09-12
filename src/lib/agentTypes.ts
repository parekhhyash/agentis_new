import type { Database } from './database.types'

export type AgentType = Database['public']['Enums']['agent_type']

export const AGENT_TYPES: {
  value: AgentType
  label: string
  description: string
}[] = [
  {
    value: 'sales_outreach',
    label: 'Sales & Outreach',
    description: 'Draft sequences, qualify leads, and book meetings.',
  },
  {
    value: 'web_design',
    label: 'Web Design',
    description: 'Production-ready pages, styled and responsive.',
  },
  {
    value: 'content_copy',
    label: 'Content & Copy',
    description: 'Blog posts, ad copy, and social captions.',
  },
  {
    value: 'customer_support',
    label: 'Customer Support',
    description: 'Resolve tickets and route the rest to your team.',
  },
  {
    value: 'data_reporting',
    label: 'Data & Reporting',
    description: 'Clean weekly reports from raw numbers.',
  },
  {
    value: 'operations',
    label: 'Operations',
    description: 'Automate the repetitive back-office work.',
  },
]

export const AGENT_LABELS = Object.fromEntries(
  AGENT_TYPES.map((a) => [a.value, a.label]),
) as Record<AgentType, string>
