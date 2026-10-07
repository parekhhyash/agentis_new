// Apps users can connect so agents can act in them. To add one: give it an
// entry here, then a backend integration (see backend/integrations/) and a
// status/connect hook like useGoogleConnection.

export interface ConnectorInfo {
  id: string
  name: string
  description: string
  usedBy: string
  // Monogram tile colour (brand palette); Google uses its own mark.
  tile: string
  monogram: string
  available: boolean
}

export const CONNECTORS: ConnectorInfo[] = [
  {
    id: 'google',
    name: 'Gmail & Google Calendar',
    description: 'Send and reply to email from your Gmail, and book meetings with Google Meet links.',
    usedBy: 'Sales & Outreach',
    tile: 'bg-surface ring-1 ring-slate-200',
    monogram: 'G',
    available: true,
  },
  {
    id: 'outlook',
    name: 'Outlook & Microsoft 365',
    description: 'Email and calendar for teams on Microsoft.',
    usedBy: 'Sales & Outreach',
    tile: 'bg-brand-blue text-white',
    monogram: 'O',
    available: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get updates from your agents and hand them tasks from a channel.',
    usedBy: 'Every agent',
    tile: 'bg-brand-violet text-white',
    monogram: 'S',
    available: false,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sync researched leads and outreach activity to your CRM.',
    usedBy: 'Lead Research, Sales & Outreach',
    tile: 'bg-brand-pink text-ink',
    monogram: 'H',
    available: false,
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Read data for reports and export leads to a sheet.',
    usedBy: 'Data & Reporting',
    tile: 'bg-brand-yellow text-ink',
    monogram: 'S',
    available: false,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Publish drafts and reports to your workspace.',
    usedBy: 'Content & Copy',
    tile: 'bg-brand-mauve text-white',
    monogram: 'N',
    available: false,
  },
]
