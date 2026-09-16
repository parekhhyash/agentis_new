import type { LeadGenerationResult } from './salesAgentTypes'

const BASE_URL = import.meta.env.VITE_SALES_AGENT_API_URL ?? 'http://localhost:8000'

// The backend itself gives up after ~900s (agent_run_timeout_seconds) and
// returns a 504; give it a little longer than that so its own timeout
// message wins over a generic client-side abort.
const REQUEST_TIMEOUT_MS = 920_000

export class SalesAgentApiError extends Error {}

// Exported so callers (DashboardPage's polling) can recognize a failure as
// client-side in origin - i.e. this browser gave up, not the backend - and
// know it's still worth re-checking the row later in case the backend was
// still running and eventually writes a different, real final status via
// finalize_request.
export const STOPPED_BY_USER_MESSAGE = 'Stopped by you.'
export const CLIENT_TIMEOUT_MESSAGE = 'The request took too long and was cancelled.'

export interface CompanyContext {
  company_name?: string | null
  company_website?: string | null
  industry?: string | null
  target_audience_location?: string | null
  company_description?: string | null
}

export async function generateLeads(
  query: string,
  requestId?: string,
  companyContext?: CompanyContext,
  externalSignal?: AbortSignal,
): Promise<LeadGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // Combined manually (rather than AbortSignal.any) for broader browser
  // compatibility - either the timeout or the caller's own signal (the stop
  // button) should abort the same underlying fetch.
  let stoppedByCaller = false
  const onExternalAbort = () => {
    stoppedByCaller = true
    controller.abort()
  }
  if (externalSignal) {
    if (externalSignal.aborted) {
      onExternalAbort()
    } else {
      externalSignal.addEventListener('abort', onExternalAbort)
    }
  }

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
      throw new SalesAgentApiError(
        stoppedByCaller ? STOPPED_BY_USER_MESSAGE : CLIENT_TIMEOUT_MESSAGE,
      )
    }
    throw new SalesAgentApiError(
      `Could not reach the agent API at ${BASE_URL}. Is the backend running?`,
    )
  } finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail ?? response.statusText
    throw new SalesAgentApiError(`Agent request failed (${response.status}): ${detail}`)
  }

  return response.json() as Promise<LeadGenerationResult>
}

// Best-effort: tells the backend to stop the run at its next checkpoint so
// it doesn't keep burning LLM tokens after the user has already given up on
// it client-side. Swallow errors - the frontend abort() already stops the
// in-flight fetch regardless of whether this reaches the backend.
export async function cancelLeadsGeneration(requestId: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/sales-agent/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId }),
    })
  } catch {
    // Nothing useful to do client-side if this fails.
  }
}
