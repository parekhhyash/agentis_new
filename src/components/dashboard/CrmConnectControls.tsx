import { useState } from 'react'

import { listCrmTools, type CrmProvider, type CrmTool, type useCrmConnections } from '../../lib/crm'

const KIND_LABELS: Record<CrmTool['kind'], { title: string; tone: string }> = {
  read: { title: 'Looks up on its own', tone: 'bg-emerald-50 text-emerald-700' },
  write: { title: 'Asks you first', tone: 'bg-amber-50 text-amber-700' },
  blocked: { title: 'Never used', tone: 'bg-slate-100 text-slate-500' },
}

// The controls inside a CRM card on the Connect page.
export default function CrmConnectControls({
  provider,
  crm,
}: {
  provider: CrmProvider
  crm: ReturnType<typeof useCrmConnections>
}) {
  const status = crm.providers?.find((p) => p.provider === provider)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tools, setTools] = useState<CrmTool[] | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [loadingTools, setLoadingTools] = useState(false)
  const busy = crm.busy === provider

  async function connect() {
    setError(null)
    const problem = await crm.connect(provider, provider === 'zoho' ? url.trim() : undefined)
    if (problem) setError(problem)
    else if (provider === 'zoho') setUrl('')
  }

  async function toggleTools() {
    if (toolsOpen) return setToolsOpen(false)
    setToolsOpen(true)
    if (tools) return
    setLoadingTools(true)
    try {
      setTools((await listCrmTools(provider)).tools)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the tools')
      setToolsOpen(false)
    } finally {
      setLoadingTools(false)
    }
  }

  if (!status) return <p className="text-sm text-slate-400">{crm.error ?? 'Checking…'}</p>
  if (!status.configured) return <p className="text-sm text-amber-700">Not set up on the server yet.</p>

  return (
    <div className="space-y-3">
      {status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate" title={status.account ?? undefined}>
              {status.account}
            </span>
            {status.tool_count != null && <span className="shrink-0 text-xs text-slate-400">· {status.tool_count} tools</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void toggleTools()}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
            >
              {toolsOpen ? 'Hide tools' : 'View tools'}
            </button>
            <button
              type="button"
              onClick={() => void crm.disconnect(provider)}
              disabled={busy}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Disconnect
            </button>
          </span>
        </div>
      ) : status.connect_with === 'url' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void connect()
          }}
          className="space-y-2"
        >
          <label htmlFor={`${provider}-mcp-url`} className="block text-xs text-slate-500">
            MCP server URL from Zoho CRM: Setup &rsaquo; Developer Hub &rsaquo; MCP for AI Agents (pick Data Operations to allow
            changes)
          </label>
          <div className="flex gap-2">
            <input
              id={`${provider}-mcp-url`}
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…zohomcp.com/mcp/…/message"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="shrink-0 rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Connect'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
        >
          {busy ? `Opening ${status.name}…` : 'Connect'}
        </button>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {toolsOpen && (
        <div className="rounded-xl border border-slate-200 p-3">
          {loadingTools || !tools ? (
            <p className="text-xs text-slate-400">Asking {status.name} for its tools…</p>
          ) : tools.length === 0 ? (
            <p className="text-xs text-slate-500">This server offers no tools.</p>
          ) : (
            <div className="space-y-2.5">
              {(['read', 'write', 'blocked'] as const).map((kind) => {
                const list = tools.filter((t) => t.kind === kind)
                if (list.length === 0) return null
                return (
                  <div key={kind}>
                    <p className="mb-1 text-xs font-medium text-slate-500">
                      {KIND_LABELS[kind].title} ({list.length})
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {list.map((t) => (
                        <li key={t.name} title={t.description} className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${KIND_LABELS[kind].tone}`}>
                          {t.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
