import { useCallback, useEffect, useState } from 'react'

import { authedFetch } from './backendApi'

export interface GoogleStatus {
  configured: boolean
  connected: boolean
  email: string | null
}

// The user's Google (Gmail + Calendar) connection for the Sales & Outreach
// agent. Tokens stay on the backend; this only sees whether one exists.
export function useGoogleConnection(enabled: boolean) {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setStatus(await authedFetch<GoogleStatus>('/integrations/google/status'))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check your Google connection')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    authedFetch<GoogleStatus>('/integrations/google/status')
      .then((s) => !cancelled && setStatus(s))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not check your Google connection'))
    return () => {
      cancelled = true
    }
  }, [enabled])

  async function connect() {
    setBusy(true)
    try {
      const { url } = await authedFetch<{ url: string }>('/integrations/google/auth-url')
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in')
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await authedFetch('/integrations/google', { method: 'DELETE' })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return { status, error, busy, connect, disconnect, refresh }
}
