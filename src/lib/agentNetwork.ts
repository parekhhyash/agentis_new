import {
  BarChartIcon,
  GearIcon,
  HeadsetIcon,
  MegaphoneIcon,
  PencilIcon,
  SearchIcon,
  type IconComponent,
} from '../components/icons'
import type { AgentType } from './agentTypes'

// Layout and colours for the agent network graphic (components/agentNetwork.tsx).

export const AGENTS: { label: string; icon: IconComponent; tile: string; line: string }[] = [
  { label: 'Lead Research', icon: SearchIcon, tile: 'bg-brand-blue text-white', line: 'text-brand-blue' },
  { label: 'Sales & Outreach', icon: MegaphoneIcon, tile: 'bg-brand-violet text-white', line: 'text-brand-violet' },
  { label: 'Customer Support', icon: HeadsetIcon, tile: 'bg-brand-sky text-white', line: 'text-brand-sky' },
  { label: 'Data & Reporting', icon: BarChartIcon, tile: 'bg-brand-yellow text-ink', line: 'text-brand-yellow' },
  { label: 'Content & Copy', icon: PencilIcon, tile: 'bg-brand-pink text-ink', line: 'text-brand-pink' },
  { label: 'Operations', icon: GearIcon, tile: 'bg-brand-orchid text-white', line: 'text-brand-orchid' },
]

export const STAGE_W = 320
export const STAGE_H = 288

export const HUB = { x: 160, y: 128 }
export const ORBIT = 88
export const NODES = AGENTS.map((_, i) => {
  const a = ((-90 + i * 60) * Math.PI) / 180
  return { x: HUB.x + Math.cos(a) * ORBIT, y: HUB.y + Math.sin(a) * ORBIT }
})

// Which node each agent type sits on; the Manager coordinates from the hub.
export const AGENT_NODE: Partial<Record<AgentType, number>> = {
  lead_research: 0,
  sales_outreach: 1,
  customer_support: 2,
  data_reporting: 3,
  content_copy: 4,
  operations: 5,
}
