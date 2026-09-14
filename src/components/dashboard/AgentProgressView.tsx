import { useEffect, useState } from 'react'
import { ChevronDownIcon } from '../icons'
import type { AgentProgress } from '../../lib/salesAgentTypes'

function useElapsedSeconds(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const startMs = new Date(startedAt).getTime()

    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return elapsed
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function AgentProgressView({
  startedAt,
  progress,
}: {
  startedAt: string | null
  progress: AgentProgress | null
}) {
  const elapsed = useElapsedSeconds(startedAt)
  const steps = progress?.steps ?? []
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-500" />
        <span>{progress?.current_step ?? 'Working on it...'}</span>
        {startedAt && (
          <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-slate-400">
            {formatElapsed(elapsed)}
          </span>
        )}
      </div>

      {steps.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            <ChevronDownIcon className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Hide steps' : `Show ${steps.length} step${steps.length === 1 ? '' : 's'}`}
          </button>

          {expanded && (
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto border-l border-slate-200 pl-3">
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1
                return (
                  <li key={`${step.at}-${i}`} className="flex items-start gap-1.5 text-xs">
                    <span className="mt-0.5 shrink-0">
                      {isLast ? (
                        <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                      ) : (
                        <span className="text-green-600">&#10003;</span>
                      )}
                    </span>
                    <span className={isLast ? 'font-medium text-slate-700' : 'text-slate-400'}>
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
