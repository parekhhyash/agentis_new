import { useEffect, useRef, useState } from 'react'

import { BackendApiError } from '../../lib/backendApi'
import { deleteDataset, listDatasets, UPLOAD_ACCEPT, uploadDataset } from '../../lib/dataApi'
import type { DatasetSummary } from '../../lib/dataTypes'
import { relativeTime } from '../../lib/relativeTime'
import { SheetIcon } from '../icons'

const TYPE_LABELS: Record<string, string> = { number: 'number', date: 'date', boolean: 'yes/no', text: 'text' }

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Spreadsheets uploaded for Data & Reporting: the agent can report on any of
// them; a file attached to a message is the one that message is about.
export default function DataFilesPanel() {
  const [files, setFiles] = useState<DatasetSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listDatasets().then(setFiles)
  }, [])

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataset = await uploadDataset(file)
      setFiles((prev) => [dataset, ...(prev ?? [])])
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setConfirming(null)
    if (await deleteDataset(id)) setFiles((prev) => (prev ?? []).filter((f) => f.id !== id))
    else setError('That file could not be deleted. Try again.')
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Data files</h2>
          <p className="mt-1 text-sm text-slate-500">
            CSV or Excel files for Data &amp; Reporting, up to 5 MB each. You can also attach one to a message.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
        >
          {busy ? 'Reading file…' : 'Upload a file'}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-surface">
        {files === null ? (
          <p className="px-5 py-4 text-sm text-slate-400">Loading…</p>
        ) : files.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No files yet. Upload a sales, orders or expenses sheet and ask things like &ldquo;revenue by month&rdquo; or
            &ldquo;which product sells most&rdquo;.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {files.map((file) => (
              <li key={file.id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <SheetIcon className="shrink-0 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setOpen((id) => (id === file.id ? null : file.id))}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-slate-800">{file.filename}</p>
                    <p className="text-xs text-slate-500">
                      {file.row_count.toLocaleString('en-US')} rows · {file.columns.length} columns · {size(file.size_bytes)} ·{' '}
                      {relativeTime(file.created_at)}
                    </p>
                  </button>
                  {confirming === file.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => void remove(file.id)} className="rounded-full px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="rounded-full px-3 py-1 text-sm text-slate-500 hover:bg-slate-100">
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirming(file.id)} className="shrink-0 rounded-full px-3 py-1 text-sm text-slate-500 hover:bg-slate-100">
                      Delete
                    </button>
                  )}
                </div>
                {open === file.id && (
                  <ul className="mt-2 flex flex-wrap gap-1.5 pl-7">
                    {file.columns.map((c) => (
                      <li key={c.name} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {c.name} <span className="text-slate-400">{TYPE_LABELS[c.type] ?? c.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
