import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import type { Cell, ReportBlock, ReportColumn } from '../../../lib/dataTypes'
import { formatCell, formatNumber, niceTicks } from '../../../lib/reportFormat'

// Categorical slots in fixed order (see index.css); "Other" is neutral.
const SLOTS = ['var(--color-viz-1)', 'var(--color-viz-2)', 'var(--color-viz-3)', 'var(--color-viz-4)', 'var(--color-viz-5)', 'var(--color-viz-6)']
const OTHER = 'var(--color-viz-other)'
const GRID = 'var(--color-slate-200)'
const SURFACE = 'var(--color-surface)'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

const asNumber = (value: Cell): number | null => (typeof value === 'number' ? value : null)

// --- headline numbers -------------------------------------------------------

export function StatTiles({ tiles }: { tiles: { column: ReportColumn; value: Cell; explanation: string }[] }) {
  return (
    <div
      className={`grid gap-3 ${
        tiles.length === 1
          ? 'grid-cols-1 sm:max-w-xs'
          : tiles.length === 3
            ? 'grid-cols-2 sm:grid-cols-3'
            : tiles.length === 4 || tiles.length > 6
              ? 'grid-cols-2 sm:grid-cols-4'
              : tiles.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3'
      }`}
    >
      {tiles.map(({ column, value, explanation }, i) => (
        <div key={`${column.name}-${i}`} className="rounded-xl border border-slate-200 bg-surface px-4 py-3" title={explanation}>
          <p className="text-xs text-slate-500">{column.name}</p>
          <p className="mt-1 text-xl font-semibold break-words text-slate-900 sm:text-2xl">{formatCell(value, column, true)}</p>
          {typeof value === 'number' && formatCell(value, column, true) !== formatCell(value, column) && (
            <p className="mt-0.5 text-xs tabular-nums text-slate-400">{formatCell(value, column)}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// --- bars (categories, one series) -----------------------------------------

export function BarList({ block }: { block: ReportBlock }) {
  const [dimension, metric, ...extra] = block.columns
  const values = block.rows.map((r) => asNumber(r[1]))
  const present = values.filter((v): v is number => v !== null)
  const min = Math.min(0, ...present)
  const max = Math.max(0, ...present)
  const span = max - min || 1
  const zero = (-min / span) * 100

  return (
    <ul className="space-y-1.5" aria-label={`${block.title}: ${metric.name} by ${dimension.name}`}>
      {block.rows.map((row, i) => {
        const value = values[i]
        const width = value === null ? 0 : (Math.abs(value) / span) * 100
        const left = value !== null && value < 0 ? zero - width : zero
        const label = formatCell(row[0], dimension)
        const isOther = row[0] === 'Other' || row[0] === '(blank)'
        return (
          // Phones: label and value above a full-width bar. Wider: one row.
          <li
            key={`${label}-${i}`}
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-1 py-0.5 hover:bg-slate-50 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
          >
            <span className={`truncate text-sm ${isOther ? 'text-slate-400' : 'text-slate-700'}`} title={label}>
              {label}
            </span>
            <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              <div className="relative h-4 min-w-0">
                {value !== null && (
                  <div
                    className="absolute top-0 h-4 transition-opacity group-hover:opacity-80"
                    style={{
                      left: `${left}%`,
                      width: `max(${width}%, 2px)`,
                      background: SLOTS[0],
                      borderRadius: value < 0 ? '4px 0 0 4px' : '0 4px 4px 0',
                    }}
                  />
                )}
              </div>
            </div>
            <span className="text-right text-sm font-medium tabular-nums text-slate-800 sm:col-start-3 sm:row-start-1">
              {formatCell(row[1], metric)}
              {extra.map((c, j) => (
                <span key={c.name} className="ml-2 font-normal text-slate-500">
                  {c.name} {formatCell(row[2 + j], c)}
                </span>
              ))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// --- line (trend over time, one series) -------------------------------------

const PLOT_H = 180
const TOP = 22
const BOTTOM = 26

export function LineChart({ block }: { block: ReportBlock }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [dimension, metric] = block.columns
  const values = block.rows.map((r) => asNumber(r[1]))
  const present = values.filter((v): v is number => v !== null)
  const ticks = niceTicks(Math.min(...present, 0), Math.max(...present, 0))
  const tickLabels = ticks.map((t) => formatNumber(t, metric.unit, true))
  const left = Math.max(...tickLabels.map((t) => t.length)) * 7 + 10
  const right = 16
  const n = block.rows.length
  const plotW = Math.max(width - left - right, 10)
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const x = (i: number) => left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1))
  const y = (v: number) => TOP + PLOT_H * (1 - (v - lo) / (hi - lo || 1))

  let path = ''
  values.forEach((v, i) => {
    if (v === null) return
    path += `${path && values[i - 1] !== null ? 'L' : 'M'}${x(i)},${y(v)}`
  })
  const baseline = y(Math.max(lo, 0))
  const runs: number[][] = []
  values.forEach((v, i) => {
    if (v === null) return
    if (i === 0 || values[i - 1] === null) runs.push([])
    runs[runs.length - 1].push(i)
  })
  const area = runs
    .filter((run) => run.length > 1)
    .map((run) => `M${x(run[0])},${baseline}` + run.map((i) => `L${x(i)},${y(values[i] as number)}`).join('') + `L${x(run[run.length - 1])},${baseline}Z`)
    .join('')
  const lastIndex = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop() ?? -1
  // X labels counted back from the latest period, spaced so the end-anchored
  // last label never meets its neighbour.
  const xLabels = block.rows.map((row) => formatCell(row[0], dimension, true))
  const labelWidth = Math.max(...xLabels.map((l) => l.length)) * 6.5 + 12
  const step = n > 1 ? plotW / (n - 1) : plotW
  const labelEvery = Math.max(1, Math.ceil((labelWidth * 1.5) / step))
  const shownLabels = new Set<number>()
  for (let i = n - 1; i >= 0; i -= labelEvery) shownLabels.add(i)

  function pick(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const position = event.clientX - box.left
    setHover(n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round((position / box.width) * (n - 1)))))
  }

  function keys(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setHover((h) => Math.max(0, Math.min(n - 1, (h ?? lastIndex) + (event.key === 'ArrowRight' ? 1 : -1))))
  }

  const hovered = hover !== null ? { i: hover, value: values[hover] } : null
  const tipLeft = hovered ? Math.min(Math.max(x(hovered.i) - 70, 0), Math.max(width - 140, 0)) : 0

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={TOP + PLOT_H + BOTTOM}
          role="img"
          aria-label={`${block.title}: ${metric.name} per ${dimension.name}. Use the arrow keys to read values.`}
          tabIndex={0}
          onKeyDown={keys}
          onBlur={() => setHover(null)}
          className="block rounded-md focus-visible:outline-2 focus-visible:outline-sky-500"
        >
          {ticks.map((t, i) => (
            <g key={t}>
              <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
                {tickLabels[i]}
              </text>
            </g>
          ))}
          {xLabels.map((label, i) =>
            shownLabels.has(i) ? (
              <text
                key={i}
                x={x(i)}
                y={TOP + PLOT_H + 18}
                textAnchor={n === 1 ? 'middle' : i === n - 1 ? 'end' : i === 0 || x(i) - labelWidth / 2 < left ? 'start' : 'middle'}
                className="fill-slate-500 text-[11px]"
              >
                {label}
              </text>
            ) : null,
          )}
          <path d={area} fill={SLOTS[0]} fillOpacity={0.1} />
          <path d={path} fill="none" stroke={SLOTS[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {n === 1 && values[0] !== null && <circle cx={x(0)} cy={y(values[0])} r={4} fill={SLOTS[0]} stroke={SURFACE} strokeWidth={2} />}
          {lastIndex >= 0 && (
            <>
              <circle cx={x(lastIndex)} cy={y(values[lastIndex] as number)} r={4} fill={SLOTS[0]} stroke={SURFACE} strokeWidth={2} />
              <text x={x(lastIndex)} y={y(values[lastIndex] as number) - 10} textAnchor={lastIndex === 0 && n > 1 ? 'start' : 'end'} className="fill-slate-800 text-[12px] font-semibold">
                {formatCell(values[lastIndex], metric, true)}
              </text>
            </>
          )}
          {hovered && (
            <>
              <line x1={x(hovered.i)} x2={x(hovered.i)} y1={TOP} y2={TOP + PLOT_H} stroke="var(--color-slate-400)" strokeWidth={1} />
              {hovered.value !== null && (
                <circle cx={x(hovered.i)} cy={y(hovered.value)} r={4} fill={SLOTS[0]} stroke={SURFACE} strokeWidth={2} />
              )}
            </>
          )}
          <rect
            x={left}
            y={TOP}
            width={plotW}
            height={PLOT_H}
            fill="transparent"
            onPointerMove={pick}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 w-[140px] rounded-lg border border-slate-200 bg-surface px-3 py-2 shadow-md"
          style={{ left: tipLeft }}
        >
          <p className="text-sm font-semibold tabular-nums text-slate-900">{formatCell(hovered.value, metric)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: SLOTS[0] }} />
            {formatCell(block.rows[hovered.i][0], dimension)}
          </p>
        </div>
      )}
    </div>
  )
}

// --- donut (share of a whole) -----------------------------------------------

function arc(cx: number, cy: number, r: number, start: number, end: number): string {
  const point = (a: number) => `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`
  return `M${point(start)}A${r},${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${point(end)}`
}

export function Donut({ block }: { block: ReportBlock }) {
  const [active, setActive] = useState<number | null>(null)
  const [dimension, metric] = block.columns
  const values = block.rows.map((r) => asNumber(r[1]) ?? 0)
  const total = values.reduce((a, b) => a + b, 0)
  if (values.some((v) => v < 0) || total <= 0) return <BarList block={block} />

  const size = 168
  const r = 64
  const gap = 2 / r
  const sweeps = values.map((v) => (v / total) * Math.PI * 2)
  const slices = sweeps.map((sweep, i) => {
    const start = sweeps.slice(0, i).reduce((a, b) => a + b, 0)
    const label = block.rows[i][0]
    const color = label === 'Other' ? OTHER : SLOTS[i % SLOTS.length]
    return { start, end: start + sweep, sweep, color, label }
  })

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg width={size} height={size} role="img" aria-label={`${block.title}: share of ${metric.name} by ${dimension.name}`} className="shrink-0">
        {slices.map((s, i) =>
          s.sweep <= 0 ? null : s.sweep >= Math.PI * 2 - 1e-6 ? (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={26} />
          ) : (
            <path
              key={i}
              d={arc(size / 2, size / 2, r, s.start + gap / 2, Math.max(s.start + gap / 2 + 0.001, s.end - gap / 2))}
              fill="none"
              stroke={s.color}
              strokeWidth={active === i ? 30 : 26}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              className="transition-[stroke-width]"
            />
          ),
        )}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="fill-slate-900 text-[18px] font-semibold">
          {formatCell(active !== null ? values[active] : total, metric, true)}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="fill-slate-500 text-[11px]">
          {active !== null ? 'Selected' : 'Total'}
        </text>
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {slices.map((s, i) => (
          <li
            key={i}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${active === i ? 'bg-slate-100' : ''}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-700" title={formatCell(s.label, dimension)}>
              {formatCell(s.label, dimension)}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-slate-800">{formatCell(values[i], metric)}</span>
            <span className="w-12 shrink-0 text-right tabular-nums text-slate-500">
              {formatNumber((values[i] / total) * 100, '%')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- table ------------------------------------------------------------------

export function DataTable({ block }: { block: ReportBlock }) {
  const numeric = block.columns.map((c, i) => c.type === 'number' || block.rows.every((r) => r[i] === null || typeof r[i] === 'number'))
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
          <tr>
            {block.columns.map((c, i) => (
              <th key={c.name} scope="col" className={`px-3 py-2 font-medium whitespace-nowrap ${numeric[i] ? 'text-right' : ''}`}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className="border-t border-slate-100">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`px-3 py-1.5 ${numeric[i] ? 'text-right tabular-nums whitespace-nowrap' : 'max-w-[18rem] truncate'} ${
                    cell === null ? 'text-slate-400' : 'text-slate-700'
                  }`}
                  title={typeof cell === 'string' ? cell : undefined}
                >
                  {formatCell(cell, block.columns[i])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
