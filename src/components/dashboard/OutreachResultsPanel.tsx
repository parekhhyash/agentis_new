import { useState, type ReactNode } from 'react'

import { checkReplies, decideOutreachAction, type OutreachDecision } from '../../lib/outreachApi'
import {
  sentThreadId,
  type MeetingAction,
  type OutreachAction,
  type OutreachResult,
  type ReplyCheck,
} from '../../lib/outreachTypes'
import { relativeTime } from '../../lib/relativeTime'

// Editable copies of each draft, keyed by action id. Lifted to the panel so
// "Approve all" sends exactly what the user sees in every card.
type Edits = Record<string, Record<string, unknown>>

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none disabled:opacity-70'

const isOpen = (a: OutreachAction) => a.status === 'draft' || a.status === 'failed'

function splitAddresses(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((v) => v.trim())
    .filter(Boolean)
}

function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

function formatWhen(action: MeetingAction): string {
  const start = new Date(action.start)
  const end = new Date(action.end)
  const day = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time(start)} to ${time(end)} (${action.time_zone})`
}

// The fields the user can change on each kind of draft, as sent to the API.
function initialEdits(action: OutreachAction): Record<string, unknown> {
  switch (action.type) {
    case 'email':
      return { to: action.to.join(', '), cc: action.cc.join(', '), subject: action.subject, body: action.body }
    case 'reply':
      return { body: action.body }
    case 'meeting':
      return {
        title: action.title,
        attendees: action.attendees.join(', '),
        start: action.start.slice(0, 16),
        duration_minutes: minutesBetween(action.start, action.end),
        description: action.description,
        add_meet: action.add_meet,
      }
  }
}

function StatusChip({ action }: { action: OutreachAction }) {
  const styles: Record<OutreachAction['status'], [string, string]> = {
    draft: ['Draft', 'bg-slate-100 text-slate-600'],
    sent: ['Sent', 'bg-emerald-50 text-emerald-700'],
    scheduled: ['Scheduled', 'bg-emerald-50 text-emerald-700'],
    discarded: ['Discarded', 'bg-slate-100 text-slate-400'],
    failed: ['Failed', 'bg-red-50 text-red-600'],
  }
  const [label, className] = styles[action.status]
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>
}

function ReplyChip({ check }: { check: ReplyCheck }) {
  const [label, className] = check.awaiting_you
    ? ['Replied', 'bg-brand-yellow/30 text-slate-800']
    : check.replied
      ? ['Replied', 'bg-emerald-50 text-emerald-700']
      : ['No reply yet', 'bg-slate-100 text-slate-500']
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>
}

// Who answered the emails sent from this request.
function ReplyReport({ checks, checkedAt }: { checks: ReplyCheck[]; checkedAt: string | null | undefined }) {
  const replied = checks.filter((c) => c.replied).length
  return (
    <div className="rounded-xl border border-slate-200 bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">
          {replied} of {checks.length} replied
        </span>
        {checkedAt && <span className="text-xs text-slate-400">Checked {relativeTime(checkedAt)}</span>}
      </div>
      <ul className="divide-y divide-slate-100">
        {checks.map((check) => (
          <li key={check.thread_id} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                <span className="font-medium">{check.to.join(', ') || 'Unknown'}</span>
                <span className="text-slate-400"> · {check.subject}</span>
              </span>
              <ReplyChip check={check} />
            </div>
            {check.replied && check.reply_snippet && (
              <p className="mt-1.5 line-clamp-2 border-l-2 border-slate-200 pl-2 text-xs text-slate-500">
                {check.reply_snippet}
              </p>
            )}
            {check.awaiting_you && (
              <p className="mt-1 text-xs font-medium text-slate-600">A response is drafted below for you to review.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function KindIcon({ type }: { type: OutreachAction['type'] }) {
  const paths: Record<OutreachAction['type'], ReactNode> = {
    email: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    reply: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v4" />,
    meeting: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
  }
  const tone = { email: 'bg-brand-blue', reply: 'bg-brand-violet', meeting: 'bg-brand-sky' }[type]
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${tone}`}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {paths[type]}
      </svg>
    </span>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function ActionCard({
  action,
  edits,
  onEdit,
  busy,
  onDecide,
  reply,
}: {
  action: OutreachAction
  edits: Record<string, unknown>
  onEdit: (patch: Record<string, unknown>) => void
  busy: boolean
  onDecide: (decision: OutreachDecision) => void
  reply?: ReplyCheck
}) {
  const editable = isOpen(action) && !busy
  const title =
    action.type === 'meeting' ? String(edits.title ?? action.title) : action.type === 'reply' ? action.subject : String(edits.subject ?? action.subject)

  return (
    <div className={`rounded-xl border border-slate-200 bg-surface ${action.status === 'discarded' ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <KindIcon type={action.type} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
          <div className="truncate text-xs text-slate-500">
            {action.type === 'email' && `New email to ${action.to.join(', ')}`}
            {action.type === 'reply' && `Reply to ${action.to.join(', ')}`}
            {action.type === 'meeting' && formatWhen(action)}
          </div>
        </div>
        {reply && <ReplyChip check={reply} />}
        <StatusChip action={action} />
      </div>

      <div className="space-y-3 px-4 py-3">
        {action.type === 'email' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="To">
                <input
                  className={inputClass}
                  disabled={!editable}
                  value={String(edits.to ?? '')}
                  onChange={(e) => onEdit({ to: e.target.value })}
                />
              </Field>
              <Field label="Cc">
                <input
                  className={inputClass}
                  disabled={!editable}
                  placeholder="Optional"
                  value={String(edits.cc ?? '')}
                  onChange={(e) => onEdit({ cc: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Subject">
              <input
                className={inputClass}
                disabled={!editable}
                value={String(edits.subject ?? '')}
                onChange={(e) => onEdit({ subject: e.target.value })}
              />
            </Field>
          </>
        )}

        {action.type === 'reply' && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <div className="font-medium text-slate-600">
              {action.original_from}
              {action.original_date && <span className="font-normal"> · {action.original_date}</span>}
            </div>
            <p className="mt-1 line-clamp-3 whitespace-pre-line">{action.original_snippet}</p>
          </div>
        )}

        {(action.type === 'email' || action.type === 'reply') && (
          <Field label="Message">
            <textarea
              className={`${inputClass} resize-y leading-relaxed`}
              disabled={!editable}
              rows={Math.min(18, Math.max(6, String(edits.body ?? '').split('\n').length + 1))}
              value={String(edits.body ?? '')}
              onChange={(e) => onEdit({ body: e.target.value })}
            />
          </Field>
        )}

        {action.type === 'meeting' && (
          <>
            <Field label="Title">
              <input
                className={inputClass}
                disabled={!editable}
                value={String(edits.title ?? '')}
                onChange={(e) => onEdit({ title: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label={`Starts (${action.time_zone})`}>
                <input
                  type="datetime-local"
                  className={inputClass}
                  disabled={!editable}
                  value={String(edits.start ?? '')}
                  onChange={(e) => onEdit({ start: e.target.value })}
                />
              </Field>
              <Field label="Length">
                <select
                  className={inputClass}
                  disabled={!editable}
                  value={Number(edits.duration_minutes ?? 30)}
                  onChange={(e) => onEdit({ duration_minutes: Number(e.target.value) })}
                >
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} min` : `${m / 60} hr`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Guests">
              <input
                className={inputClass}
                disabled={!editable}
                placeholder="Just you"
                value={String(edits.attendees ?? '')}
                onChange={(e) => onEdit({ attendees: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                disabled={!editable}
                value={String(edits.description ?? '')}
                onChange={(e) => onEdit({ description: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={!editable}
                checked={Boolean(edits.add_meet)}
                onChange={(e) => onEdit({ add_meet: e.target.checked })}
                className="h-4 w-4 accent-sky-600"
              />
              Add a Google Meet link
            </label>
            {action.conflicts.length > 0 && isOpen(action) && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Overlaps with {action.conflicts.join(', ')}
              </p>
            )}
          </>
        )}

        {action.error && <p className="text-sm text-red-600">{action.error}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
        {isOpen(action) ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('discard')}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('approve')}
              className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {busy ? 'Working…' : action.type === 'meeting' ? 'Schedule' : 'Send'}
            </button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {(action.type === 'email' || action.type === 'reply') && action.gmail_link && (
              <a href={action.gmail_link} target="_blank" rel="noreferrer" className="font-medium text-sky-600 hover:underline">
                Open in Gmail
              </a>
            )}
            {action.type === 'meeting' && action.meet_link && (
              <a href={action.meet_link} target="_blank" rel="noreferrer" className="font-medium text-sky-600 hover:underline">
                Google Meet link
              </a>
            )}
            {action.type === 'meeting' && action.event_link && (
              <a href={action.event_link} target="_blank" rel="noreferrer" className="font-medium text-sky-600 hover:underline">
                Open in Calendar
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// API-shaped edits: address fields typed as text become lists.
function toApiEdits(action: OutreachAction, edits: Record<string, unknown>): Record<string, unknown> {
  const out = { ...edits }
  for (const key of ['to', 'cc', 'attendees']) {
    if (typeof out[key] === 'string') out[key] = splitAddresses(out[key] as string)
  }
  if (action.type === 'meeting' && typeof out.start === 'string' && out.start.length === 16) {
    out.start = `${out.start}:00`
  }
  return out
}

export default function OutreachResultsPanel({
  requestId,
  result,
  onActionChange,
  onResultChange,
}: {
  requestId: string
  result: OutreachResult
  // Merged into the stored result by the parent, so concurrent sends from
  // different cards can't overwrite each other.
  onActionChange: (action: OutreachAction) => void
  onResultChange: (result: OutreachResult) => void
}) {
  const [edits, setEdits] = useState<Edits>(() =>
    Object.fromEntries(result.actions.map((a) => [a.id, initialEdits(a)])),
  )
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [approvingAll, setApprovingAll] = useState(false)

  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const open = result.actions.filter(isOpen)
  const done = result.actions.filter((a) => a.status === 'sent' || a.status === 'scheduled').length
  const sentCount = result.actions.filter((a) => sentThreadId(a)).length
  const checks = result.reply_checks ?? []
  const checkFor = (action: OutreachAction) => {
    const thread = sentThreadId(action)
    return thread ? checks.find((c) => c.thread_id === thread) : undefined
  }

  async function runReplyCheck() {
    setChecking(true)
    setCheckError(null)
    try {
      onResultChange(await checkReplies(requestId))
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Could not check for replies')
    } finally {
      setChecking(false)
    }
  }

  async function decide(action: OutreachAction, decision: OutreachDecision) {
    setBusy((prev) => new Set(prev).add(action.id))
    let updated: OutreachAction
    try {
      updated = await decideOutreachAction(requestId, action.id, decision, toApiEdits(action, edits[action.id] ?? {}))
    } catch (err) {
      updated = { ...action, status: action.status, error: err instanceof Error ? err.message : 'Something went wrong' }
    }
    onActionChange(updated)
    setBusy((prev) => {
      const next = new Set(prev)
      next.delete(action.id)
      return next
    })
  }

  async function approveAll() {
    setApprovingAll(true)
    // One at a time, so the backend applies each update to the latest result.
    for (const action of open) await decide(action, 'approve')
    setApprovingAll(false)
  }

  return (
    <div className="space-y-4">
      {result.summary && <p className="text-[15px] text-slate-800">{result.summary}</p>}

      {result.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {result.actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {result.actions.length} draft{result.actions.length === 1 ? '' : 's'} from {result.sender_email}
            {done > 0 && ` · ${done} done`}. Nothing is sent until you approve it.
          </p>
          <div className="flex flex-wrap gap-2">
            {sentCount > 0 && (
              <button
                type="button"
                disabled={checking}
                onClick={runReplyCheck}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
                </svg>
                {checking ? 'Checking…' : 'Check for replies'}
              </button>
            )}
            {open.length > 1 && (
              <button
                type="button"
                disabled={approvingAll || busy.size > 0}
                onClick={approveAll}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {approvingAll ? 'Sending…' : `Approve all ${open.length}`}
              </button>
            )}
          </div>
        </div>
      )}

      {checkError && <p className="text-sm text-red-600">{checkError}</p>}

      {checks.length > 0 && <ReplyReport checks={checks} checkedAt={result.replies_checked_at} />}

      <div className="space-y-3">
        {result.actions.map((action) => (
          <ActionCard
            key={action.id}
            action={action}
            edits={edits[action.id] ?? initialEdits(action)}
            onEdit={(patch) => setEdits((prev) => ({ ...prev, [action.id]: { ...prev[action.id], ...patch } }))}
            busy={busy.has(action.id) || approvingAll}
            onDecide={(decision) => decide(action, decision)}
            reply={checkFor(action)}
          />
        ))}
      </div>
    </div>
  )
}
