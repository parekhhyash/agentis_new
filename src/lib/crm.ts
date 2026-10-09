import { useCallback, useEffect, useState } from 'react'

import { authedFetch } from './backendApi'

// Mirrors backend/agents/crm/schemas.py and api/crm.py.

export type CrmProvider = 'hubspot' | 'salesforce' | 'zoho'

export interface CrmProviderStatus {
  provider: CrmProvider
  name: string
  configured: boolean
  connected: boolean
  account: string | null
  tool_count: number | null
  connected_at: string | null
  connect_with: 'oauth' | 'url'
}

export interface CrmTool {
  name: string
  kind: 'read' | 'write' | 'blocked'
  description: string
}

export interface CrmCall {
  provider: CrmProvider
  tool: string
  arguments: Record<string, unknown>
  ok: boolean
  preview: string
}

export interface CrmAction {
  id: string
  provider: CrmProvider
  tool: string
  arguments: Record<string, unknown>
  summary: string
  status: 'draft' | 'done' | 'discarded' | 'failed'
  result: string | null
  error: string | null
  done_at: string | null
  sign_in_url: string | null
}

export interface CrmResult {
  providers: CrmProvider[]
  calls: CrmCall[]
  actions: CrmAction[]
  sign_in: { provider: CrmProvider; url: string }[]
  notes: string[]
}

export const CRM_NAMES: Record<CrmProvider, string> = { hubspot: 'HubSpot', salesforce: 'Salesforce', zoho: 'Zoho CRM' }

export function decideCrmAction(requestId: string, actionId: string, decision: 'approve' | 'discard'): Promise<CrmAction> {
  return authedFetch<CrmAction>(`/crm/requests/${requestId}/actions/${actionId}`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })
}

export function listCrmTools(provider: CrmProvider): Promise<{ tools: CrmTool[] }> {
  return authedFetch<{ tools: CrmTool[] }>(`/integrations/crm/${provider}/tools`)
}

// The user's CRM connections. Credentials stay on the backend; this only
// sees which CRMs are connected and as whom.
export function useCrmConnections(enabled = true) {
  const [providers, setProviders] = useState<CrmProviderStatus[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<CrmProvider | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await authedFetch<{ providers: CrmProviderStatus[] }>('/integrations/crm')
      setProviders(data.providers)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check your CRM connections')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    authedFetch<{ providers: CrmProviderStatus[] }>('/integrations/crm')
      .then((data) => !cancelled && setProviders(data.providers))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not check your CRM connections'))
    return () => {
      cancelled = true
    }
  }, [enabled])

  // HubSpot and Salesforce: off to the CRM's sign-in page. Zoho: the MCP URL
  // is checked and saved right away.
  async function connect(provider: CrmProvider, mcpUrl?: string): Promise<string | null> {
    setBusy(provider)
    try {
      const out = await authedFetch<{ url?: string }>(`/integrations/crm/${provider}/connect`, {
        method: 'POST',
        body: JSON.stringify({ mcp_url: mcpUrl ?? null }),
      })
      if (out.url) {
        window.location.href = out.url
        return null
      }
      await refresh()
      setBusy(null)
      return null
    } catch (err) {
      setBusy(null)
      return err instanceof Error ? err.message : 'Could not connect'
    }
  }

  async function disconnect(provider: CrmProvider) {
    setBusy(provider)
    try {
      await authedFetch(`/integrations/crm/${provider}`, { method: 'DELETE' })
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const connected = (providers ?? []).filter((p) => p.connected)
  return { providers, connected, error, busy, connect, disconnect, refresh }
}
