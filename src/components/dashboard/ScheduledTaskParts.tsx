import { STEP_LABELS, type ScheduledTask, type TaskStep } from '../../lib/operations'

// The numbered steps of a scheduled task, as the agents will receive them.
export function StepList({ steps }: { steps: TaskStep[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">{STEP_LABELS[step.agent]}</p>
            <p className="text-sm whitespace-pre-line text-slate-700">{step.prompt}</p>
            {step.agent === 'sales_outreach' && (
              <p className="mt-0.5 text-xs text-slate-400">Emails are drafted for you to approve; nothing is sent on its own.</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

const STATUS_PILL: Record<ScheduledTask['status'] | 'running', { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'bg-emerald-50 text-emerald-700' },
  paused: { label: 'Paused', tone: 'bg-amber-50 text-amber-700' },
  finished: { label: 'Finished', tone: 'bg-slate-100 text-slate-500' },
  running: { label: 'Running', tone: 'bg-sky-50 text-sky-700' },
}

export function TaskStatusPill({ task }: { task: Pick<ScheduledTask, 'status' | 'running'> }) {
  const pill = STATUS_PILL[task.running ? 'running' : task.status]
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.tone}`}>
      {task.running && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500 align-middle" />}
      {pill.label}
    </span>
  )
}
