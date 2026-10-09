import { useCallback, useEffect, useState } from 'react'

import { authedFetch } from './backendApi'

// Mirrors backend/agents/content_copy/schemas.py and api/social.py.

export interface ContentIssue {
  level: 'error' | 'warning'
  message: string
}

export interface Publication {
  provider: SocialProvider
  url: string
  posted_at: string
  posts: number
}

export interface ContentVariant {
  id: string
  angle: string
  text: string
  parts: string[]
  title: string | null
  subtitle: string | null
  headlines: string[]
  descriptions: string[]
  score: number | null
  scores: Record<string, number>
  reason: string
  issues: ContentIssue[]
  published: Publication[]
}

export interface ContentPiece {
  id: string
  format: string
  label: string
  platform: SocialProvider | null
  limit: number | null
  x_count: boolean
  topic: string
  variants: ContentVariant[]
  recommended_id: string | null
}

export interface ContentResult {
  kind: 'content_copy'
  request: string
  summary: string
  pieces: ContentPiece[]
  notes: string[]
}

export function isContentResult(value: unknown): value is ContentResult {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'content_copy'
}

export const SHAPES: Record<string, 'post' | 'thread' | 'article' | 'email' | 'ad'> = {
  linkedin_post: 'post',
  x_post: 'post',
  x_thread: 'thread',
  instagram_caption: 'post',
  blog_post: 'article',
  email: 'email',
  ad_copy: 'ad',
  general: 'post',
}

// Characters as X counts them (backend/agents/content_copy/formats.py): every
// link is 23, emoji and CJK count 2.
export function xLength(text: string): number {
  let total = 0
  const parts = text.split(/(https?:\/\/\S+)/i)
  for (const part of parts) {
    if (/^https?:\/\//i.test(part)) {
      total += 23
      continue
    }
    for (const char of part) {
      const code = char.codePointAt(0) ?? 0
      const light =
        code <= 0x10ff || (code >= 0x2000 && code <= 0x200d) || (code >= 0x2010 && code <= 0x201f) || (code >= 0x2032 && code <= 0x2037)
      total += light ? 1 : 2
    }
  }
  return total
}

export function textLength(text: string, xCount: boolean): number {
  return xCount ? xLength(text) : text.length
}

// Plain text for the clipboard, in the shape the platform expects.
export function variantAsText(variant: ContentVariant, format: string): string {
  const shape = SHAPES[format] ?? 'post'
  if (shape === 'thread') return variant.parts.join('\n\n')
  if (shape === 'ad')
    return [
      ...variant.headlines.map((h, i) => `Headline ${i + 1}: ${h}`),
      ...variant.descriptions.map((d, i) => `Description ${i + 1}: ${d}`),
      variant.text && `Primary text: ${variant.text}`,
    ]
      .filter(Boolean)
      .join('\n')
  if (shape === 'article') return [variant.title && `# ${variant.title}`, variant.text].filter(Boolean).join('\n\n')
  if (shape === 'email')
    return [variant.title && `Subject: ${variant.title}`, variant.subtitle && `Preview: ${variant.subtitle}`, variant.text]
      .filter(Boolean)
      .join('\n\n')
  return variant.text
}

export function publishVariant(
  requestId: string,
  body: { piece_id: string; variant_id: string; provider: SocialProvider; text?: string; parts?: string[] },
): Promise<ContentVariant> {
  return authedFetch<ContentVariant>(`/content/requests/${requestId}/publish`, { method: 'POST', body: JSON.stringify(body) })
}

// --- LinkedIn / X connections ---------------------------------------------------

export type SocialProvider = 'linkedin' | 'x'

export interface SocialStatus {
  provider: SocialProvider
  name: string
  configured: boolean
  connected: boolean
  account: string | null
  expires_at: string | null
}

export function useSocialConnections(enabled = true) {
  const [providers, setProviders] = useState<SocialStatus[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<SocialProvider | null>(null)

  const refresh = useCallback(async () => {
    try {
      setProviders((await authedFetch<{ providers: SocialStatus[] }>('/integrations/social')).providers)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check your LinkedIn and X connections')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    authedFetch<{ providers: SocialStatus[] }>('/integrations/social')
      .then((data) => !cancelled && setProviders(data.providers))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not check your connections'))
    return () => {
      cancelled = true
    }
  }, [enabled])

  async function connect(provider: SocialProvider): Promise<string | null> {
    setBusy(provider)
    try {
      const { url } = await authedFetch<{ url: string }>(`/integrations/social/${provider}/connect`, { method: 'POST' })
      window.location.href = url
      return null
    } catch (err) {
      setBusy(null)
      return err instanceof Error ? err.message : 'Could not start the sign-in'
    }
  }

  async function disconnect(provider: SocialProvider) {
    setBusy(provider)
    try {
      await authedFetch(`/integrations/social/${provider}`, { method: 'DELETE' })
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const byProvider = (p: SocialProvider) => providers?.find((s) => s.provider === p) ?? null
  return { providers, error, busy, connect, disconnect, refresh, byProvider }
}
