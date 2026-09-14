import {
  BarChartIcon,
  GearIcon,
  HeadsetIcon,
  HierarchyIcon,
  MegaphoneIcon,
  PencilIcon,
  SearchIcon,
  type IconComponent,
} from '../components/icons'
import type { Database } from './database.types'

export type AgentType = Database['public']['Enums']['agent_type']

export const AGENT_TYPES: {
  value: AgentType
  label: string
  description: string
  icon: IconComponent
}[] = [
  {
    value: 'lead_research',
    label: 'Lead Research',
    description: 'Find and qualify real companies as sales leads.',
    icon: SearchIcon,
  },
  {
    value: 'sales_outreach',
    label: 'Sales & Outreach',
    description: 'Contact and follow up with your qualified leads via email.',
    icon: MegaphoneIcon,
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Coordinates other agents to get multi-step work done.',
    icon: HierarchyIcon,
  },
  {
    value: 'content_copy',
    label: 'Content & Copy',
    description: 'Blog posts, ad copy, and social captions.',
    icon: PencilIcon,
  },
  {
    value: 'customer_support',
    label: 'Customer Support',
    description: 'Resolve tickets and route the rest to your team.',
    icon: HeadsetIcon,
  },
  {
    value: 'data_reporting',
    label: 'Data & Reporting',
    description: 'Clean weekly reports from raw numbers.',
    icon: BarChartIcon,
  },
  {
    value: 'operations',
    label: 'Operations',
    description: 'Automate the repetitive back-office work.',
    icon: GearIcon,
  },
]

export const AGENT_LABELS = Object.fromEntries(
  AGENT_TYPES.map((a) => [a.value, a.label]),
) as Record<AgentType, string>
