import { useState } from 'react'

import { BackendApiError } from '../../lib/backendApi'
import {
  decideProposal,
  runTime,
  zoneLabel,
  type OperationsResult,
  type Proposal,
  type ProposalAction,
  type ScheduledTask,
  type ScheduledTasks,
} from '../../lib/operations'
import { ClockIcon } from '../icons'
import RichText from './RichText'
import { StepList, TaskStatusPill } from './ScheduledTaskParts'

const ACTIONS: Record<ProposalAction, { title: string; confirm: string; done: string; danger?: boolean }> = {
  create: { title: 'New scheduled task', confirm: 'Create schedule', done: 'Scheduled' },
  update: { title: 'Change to a scheduled task', confirm: 'Save changes', done: 'Saved' },
  pause: { title: 'Pause', confirm: 'Pause task', done: 'Paused' },
  resume: { title: 'Resume', confirm: 'Resume task', done: 'Resumed' },
  delete: { title: 'Delete', confirm: 'Delete task', done: 'Deleted', danger: true },
  run_now: { title: 'Run now', confirm: 'Run it now', done: 'Started' },
}

function ProposalCard({
  requestId,
  proposal,
  task,
  onChange,
  onTaskChange,
  onOpenChat,
}: {
  requestId: string
  proposal: Proposal
  task: ScheduledTask | null
  onChange: (proposal: Proposal) => void
  onTaskChange: (id: string, task: ScheduledTask | null) => void
  onOpenChat: (conversationId: string) => void
}) {
  const [notify, setNotify] = useState(proposal.notify_email)
  const [busy, setBusy] = useState<'confirm' | 'discard' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const action = ACTIONS[proposal.action]
  const open = proposal.status === 'proposed'
  const tz = proposal.schedule?.timezone ?? ''
  const showsSchedule = proposal.action === 'create' || proposal.action === 'resume'
  const scheduleChanged = proposal.changes.some((c) => c.startsWith('When:'))
  const hasEmailSwitch = proposal.action === 'create' || proposal.action === 'update'
  const stepsChanged = proposal.action === 'create' || proposal.changes.some((c) => c.startsWith('Steps:'))

  async function decide(decision: 'confirm' | 'discard') {
    setBusy(decision)
    setError(null)
    try {
      const out = await decideProposal(requestId, proposal.id, decision, hasEmailSwitch ? notify : undefined)
      onChange(out.proposal)
      if (decision === 'confirm') onTaskChange(out.proposal.task_id ?? proposal.task_id ?? '', out.task)
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'Something went wrong, try again.')
    } finally {
      setBusy(null)
    }
  }

  const nextRun = task?.next_run_at ?? (proposal.action === 'create' ? proposal.next_runs[0] : null)

  return (
    <li className={`rounded-xl border border-slate-200 p-4 ${proposal.status === 'discarded' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{action.title}</p>
          <p className="font-semibold text-slate-900">{proposal.name}</p>
        </div>
        {proposal.status === 'applied' && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            {action.done}
          </span>
        )}
        {proposal.status === 'discarded' && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Discarded</span>
        )}
      </div>

      {showsSchedule && proposal.schedule && (
        <div className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <ClockIcon className="mt-0.5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p>
              {proposal.schedule_text} <span className="text-slate-400">({zoneLabel(tz)} time)</span>
            </p>
            {open && proposal.next_runs.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-500">Next: {proposal.next_runs.map((r) => runTime(r, tz)).join(' · ')}</p>
            )}
          </div>
        </div>
      )}

      {proposal.changes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {proposal.changes.map((change) => (
            <li key={change} className="flex gap-2">
              <span className="text-slate-400">&bull;</span>
              <span className="min-w-0">{change}</span>
            </li>
          ))}
        </ul>
      )}
      {open && scheduleChanged && proposal.next_runs.length > 0 && (
        <p className="mt-1.5 pl-4 text-xs text-slate-500">Next: {proposal.next_runs.map((r) => runTime(r, tz)).join(' · ')}</p>
      )}

      {stepsChanged && proposal.steps.length > 0 && (
        <div className="mt-3">
          <StepList steps={proposal.steps} />
        </div>
      )}

      {open &&
        proposal.warnings.map((warning) => (
          <p key={warning} className="mt-2 text-xs text-amber-700">
            {warning}
          </p>
        ))}

      {hasEmailSwitch &&
        (open ? (
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-blue"
            />
            Email me the results after each run
          </label>
        ) : (
          proposal.status === 'applied' &&
          proposal.notify_email && <p className="mt-3 text-xs text-slate-500">Results are emailed to you after each run.</p>
        ))}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {open ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void decide('confirm')}
            disabled={busy !== null}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              action.danger ? 'bg-red-600 hover:bg-red-600/90' : 'bg-brand-blue hover:bg-brand-blue/90'
            }`}
          >
            {busy === 'confirm' ? 'Saving…' : action.confirm}
          </button>
          <button
            type="button"
            onClick={() => void decide('discard')}
            disabled={busy !== null}
            className="rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      ) : (
        proposal.status === 'applied' &&
        proposal.action !== 'delete' && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {proposal.action === 'run_now' ? (
              <span className="text-slate-600">Running now. Results appear in the task&rsquo;s chat.</span>
            ) : (
              task?.status === 'active' &&
              nextRun && <span className="text-slate-600">Next run {runTime(nextRun, task?.schedule.timezone ?? tz)}</span>
            )}
            {task?.conversation_id && (
              <button
                type="button"
                onClick={() => onOpenChat(task.conversation_id!)}
                className="font-medium text-sky-600 hover:underline"
              >
                Open its chat
              </button>
            )}
          </div>
        )
      )}
    </li>
  )
}

function TaskList({ tasks, onOpenScheduled }: { tasks: ScheduledTask[]; onOpenScheduled: () => void }) {
  return (
    <div className="mt-3">
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <p className="min-w-0 flex-1 text-sm font-medium text-slate-800">{task.name}</p>
            <TaskStatusPill task={task} />
            <p className="w-full text-xs text-slate-500">
              {task.schedule_text} ({zoneLabel(task.schedule.timezone)} time)
              {task.status === 'active' && task.next_run_at && ` · next ${runTime(task.next_run_at, task.schedule.timezone)}`}
            </p>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onOpenScheduled} className="mt-2 text-sm font-medium text-sky-600 hover:underline">
        Manage on the Scheduled page
      </button>
    </div>
  )
}

export default function OperationsResultPanel({
  requestId,
  result,
  scheduled,
  onResultChange,
  onOpenChat,
  onOpenScheduled,
}: {
  requestId: string
  result: OperationsResult
  scheduled: ScheduledTasks
  onResultChange?: (result: OperationsResult) => void
  onOpenChat: (conversationId: string) => void
  onOpenScheduled: () => void
}) {
  const live = (id: string | null) => (id ? (scheduled.tasks?.find((t) => t.id === id) ?? null) : null)
  // The live list is fresher than the snapshot taken when the agent answered.
  const listed = result.tasks.map((t) => live(t.id) ?? t)

  return (
    <div>
      <RichText text={result.reply} />

      {result.proposals.length > 0 && (
        <ul className="mt-4 space-y-3">
          {result.proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              requestId={requestId}
              proposal={proposal}
              task={live(proposal.task_id)}
              onChange={(next) =>
                onResultChange?.({ ...result, proposals: result.proposals.map((p) => (p.id === next.id ? next : p)) })
              }
              onTaskChange={(id, task) => {
                scheduled.replace(id, task)
                void scheduled.refresh()
              }}
              onOpenChat={onOpenChat}
            />
          ))}
        </ul>
      )}

      {listed.length > 0 && <TaskList tasks={listed} onOpenScheduled={onOpenScheduled} />}

      {result.notes.map((note) => (
        <p key={note} className="mt-3 text-xs text-slate-500">
          {note}
        </p>
      ))}
    </div>
  )
}
