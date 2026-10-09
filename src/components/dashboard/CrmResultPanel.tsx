import { useState } from 'react'

import { BackendApiError } from '../../lib/backendApi'
import { CRM_NAMES, decideCrmAction, type CrmAction, type CrmResult } from '../../lib/crm'
import { ChevronDownIcon } from '../icons'

const STATUS: Record<CrmAction['status'], { label: string; tone: string }> = {
  draft: { label: 'Waiting for you', tone: 'bg-amber-50 text-amber-700' },
  done: { label: 'Done', tone: 'bg-emerald-50 text-emerald-700' },
  discarded: { label: 'Discarded', tone: 'bg-slate-100 text-slate-500' },
  failed: { label: 'Failed', tone: 'bg-red-50 text-red-700' },
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-56 overflow-auto rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-slate-600">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function ActionCard({
  action,
  busy,
  onDecide,
}: {
  action: CrmAction
  busy: boolean
  onDecide: (decision: 'approve' | 'discard') => void
}) {
  const [open, setOpen] = useState(false)
  const status = STATUS[action.status]
  const pending = action.status === 'draft' || action.status === 'failed'

  return (
    <li className={`rounded-xl border border-slate-200 p-3 ${action.status === 'discarded' ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start gap-2">
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {CRM_NAMES[action.provider]}
        </span>
        <p className="min-w-0 flex-1 text-sm text-slate-800">{action.summary}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>{status.label}</span>
      </div>

      {action.error && <p className="mt-2 text-xs text-red-700">{action.error}</p>}
      {action.sign_in_url && (
        <a href={action.sign_in_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-sky-600 hover:underline">
          Sign in to {CRM_NAMES[action.provider]}, then try again
        </a>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ChevronDownIcon className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? 'Hide details' : `Details (${action.tool})`}
        </button>
        {pending && (
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('discard')}
              className="rounded-full px-3 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('approve')}
              className="rounded-full bg-brand-blue px-3.5 py-1 text-sm font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {busy ? 'Working…' : action.status === 'failed' ? 'Try again' : 'Make change'}
            </button>
          </span>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <Json value={action.arguments} />
          {action.result && (
            <>
              <p className="text-xs font-medium text-slate-500">{CRM_NAMES[action.provider]} answered</p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] whitespace-pre-wrap break-words text-slate-600">
                {action.result}
              </pre>
            </>
          )}
        </div>
      )}
    </li>
  )
}

// The CRM part of a General reply: what it looked up, sign-in prompts, and
// the changes it drafted (each runs only when approved here).
export default function CrmResultPanel({
  requestId,
  crm,
  onChange,
}: {
  requestId: string
  crm: CrmResult
  onChange: (crm: CrmResult) => void
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [showCalls, setShowCalls] = useState(false)
  const drafts = crm.actions.filter((a) => a.status === 'draft')
  const providers = [...new Set(crm.calls.map((c) => c.provider))]

  async function decide(action: CrmAction, decision: 'approve' | 'discard'): Promise<CrmAction | null> {
    setBusy((b) => new Set(b).add(action.id))
    setError(null)
    try {
      return await decideCrmAction(requestId, action.id, decision)
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'That change could not be made.')
      return null
    } finally {
      setBusy((b) => {
        const next = new Set(b)
        next.delete(action.id)
        return next
      })
    }
  }

  async function run(targets: CrmAction[], decision: 'approve' | 'discard') {
    let actions = crm.actions
    for (const action of targets) {
      const updated = await decide(action, decision)
      if (!updated) break
      actions = actions.map((a) => (a.id === updated.id ? updated : a))
      onChange({ ...crm, actions })
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {crm.calls.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCalls((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ChevronDownIcon className={`transition-transform ${showCalls ? 'rotate-180' : ''}`} />
            Looked in {providers.map((p) => CRM_NAMES[p]).join(' and ')} ({crm.calls.length} lookup{crm.calls.length === 1 ? '' : 's'})
          </button>
          {showCalls && (
            <ul className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
              {crm.calls.map((call, i) => (
                <li key={i} className="text-xs">
                  <span className={call.ok ? 'text-green-600' : 'text-red-600'}>{call.ok ? '✓' : '✗'}</span>{' '}
                  <span className="font-mono text-slate-700">{call.tool}</span>{' '}
                  <span className="break-all font-mono text-slate-400">{JSON.stringify(call.arguments)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {crm.sign_in.map((s) => (
        <div key={s.url} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {CRM_NAMES[s.provider]} needs you to sign in before it can answer.{' '}
          <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold underline">
            Sign in
          </a>
          , then ask again.
        </div>
      ))}

      {crm.actions.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">
              Changes to make in your CRM. Nothing changes until you approve.
            </p>
            {drafts.length > 1 && (
              <button
                type="button"
                disabled={busy.size > 0}
                onClick={() => void run(drafts, 'approve')}
                className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Approve all {drafts.length}
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {crm.actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                busy={busy.has(action.id)}
                onDecide={(decision) => void run([action], decision)}
              />
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {crm.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-500">
          {crm.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
