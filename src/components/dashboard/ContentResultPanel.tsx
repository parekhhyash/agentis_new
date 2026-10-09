import { useState } from 'react'

import { BackendApiError } from '../../lib/backendApi'
import {
  publishVariant,
  SHAPES,
  textLength,
  variantAsText,
  type ContentPiece,
  type ContentResult,
  type ContentVariant,
  type SocialProvider,
  type useSocialConnections,
} from '../../lib/content'
import RichText from './RichText'

const NETWORK: Record<SocialProvider, string> = { linkedin: 'LinkedIn', x: 'X' }
const CRITERIA = ['hook', 'clarity', 'specificity', 'voice', 'cta'] as const

function Counter({ value, limit, xCount }: { value: string; limit: number | null; xCount: boolean }) {
  if (!limit) return null
  const size = textLength(value, xCount)
  return (
    <span className={`text-[11px] tabular-nums ${size > limit ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
      {size.toLocaleString('en-US')} / {limit.toLocaleString('en-US')}
    </span>
  )
}

function Field({ label, value, limit }: { label: string; value: string | null; limit?: number }) {
  if (!value) return null
  return (
    <div>
      <p className="flex items-center justify-between text-[11px] font-medium tracking-wide text-slate-400 uppercase">
        {label}
        {limit && <Counter value={value} limit={limit} xCount={false} />}
      </p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  )
}

function Body({
  piece,
  variant,
  editing,
  draft,
  onDraft,
}: {
  piece: ContentPiece
  variant: ContentVariant
  editing: boolean
  draft: { text: string; parts: string[] }
  onDraft: (draft: { text: string; parts: string[] }) => void
}) {
  const shape = SHAPES[piece.format] ?? 'post'
  const box = 'w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none'

  if (shape === 'thread') {
    return (
      <ol className="space-y-2">
        {draft.parts.map((part, i) => (
          <li key={i} className="rounded-lg border border-slate-200 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {i + 1}/{draft.parts.length}
              </span>
              <Counter value={part} limit={piece.limit} xCount={piece.x_count} />
            </div>
            {editing ? (
              <textarea
                value={part}
                rows={3}
                onChange={(e) => onDraft({ ...draft, parts: draft.parts.map((p, j) => (j === i ? e.target.value : p)) })}
                className={box}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap text-slate-800">{part}</p>
            )}
          </li>
        ))}
      </ol>
    )
  }
  if (shape === 'ad') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Headlines (30 max)</p>
          {variant.headlines.map((h, i) => (
            <p key={i} className="flex items-baseline justify-between gap-2 text-sm text-slate-800">
              <span>{h}</span>
              <Counter value={h} limit={30} xCount={false} />
            </p>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Descriptions (90 max)</p>
          {variant.descriptions.map((d, i) => (
            <p key={i} className="text-sm text-slate-800">
              {d} <Counter value={d} limit={90} xCount={false} />
            </p>
          ))}
        </div>
        <div className="sm:col-span-2">
          <Field label="Primary text" value={variant.text} limit={125} />
        </div>
      </div>
    )
  }
  if (shape === 'article') {
    return (
      <div className="space-y-2">
        <h4 className="text-base font-semibold text-slate-900">{variant.title}</h4>
        <Field label="Meta description" value={variant.subtitle} limit={155} />
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 px-3 py-2">
          <RichText text={variant.text} />
        </div>
      </div>
    )
  }
  if (shape === 'email') {
    return (
      <div className="space-y-2">
        <Field label="Subject" value={variant.title} limit={60} />
        <Field label="Preview" value={variant.subtitle} limit={90} />
        <p className="rounded-lg border border-slate-200 px-3 py-2 text-sm whitespace-pre-wrap text-slate-800">{variant.text}</p>
      </div>
    )
  }
  return (
    <div>
      {editing ? (
        <textarea value={draft.text} rows={8} onChange={(e) => onDraft({ ...draft, text: e.target.value })} className={box} />
      ) : (
        <p className="rounded-lg border border-slate-200 px-3 py-2 text-sm whitespace-pre-wrap text-slate-800">{draft.text}</p>
      )}
      <div className="mt-1 text-right">
        <Counter value={draft.text} limit={piece.limit} xCount={piece.x_count} />
      </div>
    </div>
  )
}

function PieceCard({
  requestId,
  piece,
  social,
  onPieceChange,
  onOpenConnect,
}: {
  requestId: string
  piece: ContentPiece
  social: ReturnType<typeof useSocialConnections>
  onPieceChange: (piece: ContentPiece) => void
  onOpenConnect: () => void
}) {
  const [selectedId, setSelectedId] = useState(piece.recommended_id ?? piece.variants[0]?.id)
  const variant = piece.variants.find((v) => v.id === selectedId) ?? piece.variants[0]
  const [drafts, setDrafts] = useState<Record<string, { text: string; parts: string[] }>>({})
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [posting, setPosting] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  if (!variant) return null
  const draft = drafts[variant.id] ?? { text: variant.text, parts: variant.parts }
  const edited = draft.text !== variant.text || draft.parts.join('\u0000') !== variant.parts.join('\u0000')
  const network = piece.platform
  const status = network ? social.byProvider(network) : null
  const published = network ? variant.published.find((p) => p.provider === network) : undefined
  const overLimit =
    piece.limit != null &&
    (SHAPES[piece.format] === 'thread'
      ? draft.parts.some((p) => textLength(p, piece.x_count) > (piece.limit ?? Infinity))
      : textLength(draft.text, piece.x_count) > piece.limit)

  async function copy() {
    const text = variantAsText({ ...variant, text: draft.text, parts: draft.parts }, piece.format)
    try {
      await navigator.clipboard.writeText(text)
      setMessage({ tone: 'ok', text: 'Copied' })
    } catch {
      setMessage({ tone: 'error', text: 'Copy failed; select the text instead' })
    }
  }

  async function post() {
    if (!network) return
    setPosting(true)
    setMessage(null)
    try {
      const updated = await publishVariant(requestId, {
        piece_id: piece.id,
        variant_id: variant.id,
        provider: network,
        ...(edited ? (SHAPES[piece.format] === 'thread' ? { parts: draft.parts } : { text: draft.text }) : {}),
      })
      onPieceChange({ ...piece, variants: piece.variants.map((v) => (v.id === updated.id ? updated : v)) })
      setEditing(false)
      setConfirming(false)
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof BackendApiError ? err.message : 'Posting failed' })
      setConfirming(false)
    } finally {
      setPosting(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold text-slate-900">{piece.label}</h4>
        {piece.topic && <span className="min-w-0 truncate text-xs text-slate-500">{piece.topic}</span>}
      </div>

      {piece.variants.length > 1 && (
        <div role="tablist" className="mb-3 flex flex-wrap gap-1.5">
          {piece.variants.map((v, i) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              aria-selected={v.id === variant.id}
              onClick={() => {
                setSelectedId(v.id)
                setEditing(false)
                setConfirming(false)
                setMessage(null)
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                v.id === variant.id ? 'border-sky-400 bg-sky-50 text-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="font-semibold">Option {i + 1}</span>
              {v.score != null && <span className="ml-1 tabular-nums text-slate-500">{v.score.toFixed(1)}</span>}
              {v.id === piece.recommended_id && <span className="ml-1.5 font-semibold text-brand-blue">Recommended</span>}
              {v.angle && <span className="block text-[11px] text-slate-400">{v.angle}</span>}
            </button>
          ))}
        </div>
      )}

      <Body piece={piece} variant={variant} editing={editing} draft={draft} onDraft={(d) => setDrafts((prev) => ({ ...prev, [variant.id]: d }))} />

      {variant.issues.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {variant.issues.map((issue, i) => (
            <li
              key={i}
              className={`rounded-md px-2 py-0.5 text-[11px] ${issue.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {(variant.reason || Object.keys(variant.scores).length > 0) && (
        <p className="mt-2 text-xs text-slate-500">
          {variant.reason}
          {Object.keys(variant.scores).length > 0 && (
            <span className="ml-1 text-slate-400">
              ({CRITERIA.filter((c) => c in variant.scores).map((c) => `${c} ${variant.scores[c]}`).join(' · ')})
            </span>
          )}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void copy()} className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
          Copy
        </button>
        {(SHAPES[piece.format] === 'post' || SHAPES[piece.format] === 'thread') && !published && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            {editing ? 'Done editing' : 'Edit'}
          </button>
        )}
        {network &&
          (published ? (
            <a href={published.url} target="_blank" rel="noreferrer" className="ml-auto text-sm font-medium text-emerald-700 hover:underline">
              Posted on {NETWORK[network]}
              {published.posts > 1 ? ` (${published.posts} posts)` : ''} &middot; View
            </a>
          ) : !status?.configured ? (
            <span className="ml-auto text-xs text-slate-400">{NETWORK[network]} posting isn&rsquo;t set up on the server</span>
          ) : !status.connected ? (
            <button type="button" onClick={onOpenConnect} className="ml-auto text-sm font-medium text-sky-600 hover:underline">
              Connect {NETWORK[network]} to post
            </button>
          ) : confirming ? (
            <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-600">
                Post publicly as {status.account}?{network === 'x' ? ' Uses X API credits.' : ''}
              </span>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-3 py-1 text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                disabled={posting}
                onClick={() => void post()}
                className="rounded-full bg-brand-blue px-3.5 py-1 font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Post now'}
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={overLimit}
              title={overLimit ? 'Shorten it to fit the limit first' : undefined}
              onClick={() => setConfirming(true)}
              className="ml-auto rounded-full bg-brand-blue px-3.5 py-1 text-sm font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-50"
            >
              Post to {NETWORK[network]}
            </button>
          ))}
      </div>
      {message && <p className={`mt-2 text-xs ${message.tone === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</p>}
    </section>
  )
}

export default function ContentResultPanel({
  requestId,
  result,
  social,
  onResultChange,
  onOpenConnect,
}: {
  requestId: string
  result: ContentResult
  social: ReturnType<typeof useSocialConnections>
  onResultChange: (result: ContentResult) => void
  onOpenConnect: () => void
}) {
  return (
    <div className="space-y-4">
      {result.summary && <p className="text-sm text-slate-700">{result.summary}</p>}
      {result.pieces.map((piece) => (
        <PieceCard
          key={piece.id}
          requestId={requestId}
          piece={piece}
          social={social}
          onOpenConnect={onOpenConnect}
          onPieceChange={(updated) => onResultChange({ ...result, pieces: result.pieces.map((p) => (p.id === updated.id ? updated : p)) })}
        />
      ))}
      {result.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-500">
          {result.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
