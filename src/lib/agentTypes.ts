import {
  BarChartIcon,
  GearIcon,
  HeadsetIcon,
  LayoutIcon,
  MegaphoneIcon,
  PencilIcon,
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
    value: 'sales_outreach',
    label: 'Sales & Outreach',
    description: 'Draft sequences, qualify leads, and book meetings.',
    icon: MegaphoneIcon,
  },
  {
    value: 'web_design',
    label: 'Web Design',
    description: 'Production-ready pages, styled and responsive.',
    icon: LayoutIcon,
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
