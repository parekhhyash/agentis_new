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
  gmail_thread_id?: string | null
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

// Whether someone answered an email sent through Agentis.
export interface ReplyCheck {
  thread_id: string
  to: string[]
  subject: string
  replied: boolean
  awaiting_you: boolean
  reply_from: string | null
  reply_at: string | null
  reply_snippet: string | null
  gmail_link: string | null
}

// The Gmail thread a sent email or reply lives in, for matching reply checks.
export function sentThreadId(action: OutreachAction): string | null {
  if (action.status !== 'sent') return null
  if (action.type === 'email') return action.gmail_thread_id ?? null
  if (action.type === 'reply') return action.thread_id
  return null
}

export interface OutreachResult {
  kind: 'sales_outreach'
  query: string
  summary: string
  sender_email: string
  sender_name: string
  time_zone: string
  actions: OutreachAction[]
  notes: string[]
  reply_checks?: ReplyCheck[]
  replies_checked_at?: string | null
}

export function isOutreachResult(value: unknown): value is OutreachResult {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'sales_outreach'
}
