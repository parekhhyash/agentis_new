// Mirrors backend/agents/sales_outreach/schemas.py.

export type OutreachStatus = 'draft' | 'sent' | 'scheduled' | 'discarded' | 'failed'

interface BaseAction {
  id: string
  status: OutreachStatus
  error: string | null
  rationale: string | null
}

export interface EmailAction extends BaseAction {
  type: 'email'
  to: string[]
  cc: string[]
  subject: string
  body: string
  gmail_link: string | null
}

export interface ReplyAction extends BaseAction {
  type: 'reply'
  thread_id: string
  to: string[]
  subject: string
  body: string
  original_from: string
  original_date: string
  original_snippet: string
  gmail_link: string | null
}

export interface MeetingAction extends BaseAction {
  type: 'meeting'
  title: string
  attendees: string[]
  start: string
  end: string
  time_zone: string
  description: string
  add_meet: boolean
  conflicts: string[]
  event_link: string | null
  meet_link: string | null
}

export type OutreachAction = EmailAction | ReplyAction | MeetingAction

export interface OutreachResult {
  kind: 'sales_outreach'
  query: string
  summary: string
  sender_email: string
  sender_name: string
  time_zone: string
  actions: OutreachAction[]
  notes: string[]
}

export function isOutreachResult(value: unknown): value is OutreachResult {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'sales_outreach'
}
