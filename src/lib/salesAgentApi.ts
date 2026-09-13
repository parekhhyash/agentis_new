import type { LeadGenerationResult } from './salesAgentTypes'

const BASE_URL = import.meta.env.VITE_SALES_AGENT_API_URL ?? 'http://localhost:8000'

// The backend itself gives up after ~590s (agent_run_timeout_seconds) and
// returns a 504; give it a little longer than that so its own timeout
// message wins over a generic client-side abort.
const REQUEST_TIMEOUT_MS = 620_000

export class SalesAgentApiError extends Error {}

export interface CompanyContext {
  company_name?: string | null
  company_website?: string | null
  industry?: string | null
  company_size?: string | null
  company_description?: string | null
}

export async function generateLeads(
  query: string,
  requestId?: string,
  companyContext?: CompanyContext,
): Promise<LeadGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${BASE_URL}/sales-agent/generate-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        request_id: requestId,
        company_context: companyContext,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new SalesAgentApiError('The request took too long and was cancelled.')
    }
    throw new SalesAgentApiError(
      `Could not reach the agent API at ${BASE_URL}. Is the backend running?`,
    )
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail ?? response.statusText
    throw new SalesAgentApiError(`Agent request failed (${response.status}): ${detail}`)
  }

  return response.json() as Promise<LeadGenerationResult>
}
