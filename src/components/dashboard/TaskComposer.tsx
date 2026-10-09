import { useRef, useState, type DragEvent } from 'react'
import { AGENT_TYPES, type AgentType } from '../../lib/agentTypes'
import { BackendApiError } from '../../lib/backendApi'
import { UPLOAD_ACCEPT, uploadDataset } from '../../lib/dataApi'
import type { Attachment } from '../../lib/dataTypes'
import { ArrowUpIcon, ChevronDownIcon, CloseIcon, PaperclipIcon, SheetIcon, StopIcon } from '../icons'

interface PendingFile {
  key: string
  name: string
  status: 'uploading' | 'ready' | 'error'
  attachment?: Attachment
  error?: string
}

// Agents that can't use files: attaching one switches to Data & Reporting.
const NO_FILES: AgentType[] = ['lead_research', 'sales_outreach']

// Grows the composer with content, but caps it so a very long paste doesn't
// push the rest of the page around - it scrolls internally past this.
const MAX_TEXTAREA_HEIGHT = 200

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
}

export default function TaskComposer({
  agentType,
  onAgentTypeChange,
  onSubmit,
  isRunning = false,
  onStop,
  blocked = false,
  runnableAgents = ['lead_research'],
}: {
  agentType: AgentType
  onAgentTypeChange: (value: AgentType) => void
  onSubmit: (prompt: string, attachments: Attachment[]) => Promise<void>
  isRunning?: boolean
  onStop?: () => void
  // The selected agent needs setup first (e.g. connecting Google).
  blocked?: boolean
  runnableAgents?: AgentType[]
}) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploading = files.some((f) => f.status === 'uploading')

  const selectedAgent = AGENT_TYPES.find((a) => a.value === agentType) ?? AGENT_TYPES[0]
  const SelectedIcon = selectedAgent.icon

  async function handleSubmit() {
    const prompt = value.trim()
    if (!prompt || submitting || blocked || uploading) return
    setSubmitting(true)
    try {
      const attachments = files.flatMap((f) => (f.attachment ? [f.attachment] : []))
      await onSubmit(prompt, attachments)
      setValue('')
      setFiles([])
      autoResize(textareaRef.current)
    } finally {
      setSubmitting(false)
    }
  }

  function attach(list: FileList | null) {
    const picked = Array.from(list ?? []).slice(0, 5)
    if (picked.length === 0) return
    if (NO_FILES.includes(agentType)) onAgentTypeChange('data_reporting')
    for (const file of picked) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      setFiles((prev) => [...prev, { key, name: file.name, status: 'uploading' }])
      uploadDataset(file)
        .then((dataset) => {
          const attachment: Attachment = { type: 'dataset', id: dataset.id, name: dataset.filename, rows: dataset.row_count }
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'ready', attachment } : f)))
        })
        .catch((err: unknown) => {
          const error = err instanceof BackendApiError ? err.message : 'Upload failed.'
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'error', error } : f)))
        })
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setDragging(false)
    attach(event.dataTransfer.files)
  }

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={handleDrop}
      className={`relative w-full rounded-2xl border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.10)] sm:p-5 ${
        dragging ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-300'
      }`}
    >
      {files.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {files.map((f) => (
            <li
              key={f.key}
              className={`flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${
                f.status === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
              title={f.error}
            >
              {f.status === 'uploading' ? (
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
              ) : (
                <SheetIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              )}
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {f.status === 'uploading'
                  ? 'Reading…'
                  : f.status === 'error'
                    ? f.error
                    : `${(f.attachment?.rows ?? 0).toLocaleString('en-US')} rows`}
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((prev) => prev.filter((p) => p.key !== f.key))}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          autoResize(e.target)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        placeholder="Describe what you want to do..."
        style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
        className="w-full resize-none overflow-y-auto bg-transparent text-[17px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between">
        <div className="relative flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              attach(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            aria-label="Attach a CSV or Excel file"
            title="Attach a CSV or Excel file"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <PaperclipIcon />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] font-medium text-slate-800 transition-colors hover:bg-slate-100"
          >
            <SelectedIcon />
            {selectedAgent.label}
            <ChevronDownIcon />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-surface py-1.5 shadow-lg">
                {AGENT_TYPES.map((agent) => (
                  <button
                    key={agent.value}
                    type="button"
                    onClick={() => {
                      onAgentTypeChange(agent.value)
                      setMenuOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                      agent.value === agentType ? 'text-sky-600' : 'text-slate-700'
                    }`}
                  >
                    <agent.icon className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{agent.label}</span>
                    {!runnableAgents.includes(agent.value) && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        Soon
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {isRunning ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={onStop}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-red-400 text-red-500 transition-colors hover:bg-red-50"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Submit"
            onClick={handleSubmit}
            disabled={submitting || blocked || uploading || value.trim().length === 0}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-sky-400 text-sky-500 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUpIcon />
          </button>
        )}
      </div>
    </div>
  )
}
