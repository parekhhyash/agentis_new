import { AGENT_LABELS } from '../../lib/agentTypes'
import type { Conversation } from '../../lib/conversations'
import type { Tables } from '../../lib/database.types'
import { relativeTime } from '../../lib/relativeTime'
import { ClockIcon } from '../icons'

type AgentRequest = Tables<'agent_requests'>

const STATUS_DOT: Record<AgentRequest['status'], string> = {
  queued: 'bg-slate-300',
  in_progress: 'bg-sky-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
}

export default function ConversationSidebar({
  conversations,
  latestTurn,
  loading,
  selectedId,
  onSelect,
  scheduledIds,
}: {
  conversations: Conversation[]
  latestTurn: (conversationId: string) => AgentRequest | undefined
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  // Chats that scheduled tasks write into.
  scheduledIds?: Set<string>
}) {
  if (loading) {
    return <p className="px-3 py-6 text-center text-sm text-slate-400">Loading...</p>
  }

  if (conversations.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-slate-400">
        No chats yet. Start a conversation to see it here.
      </p>
    )
  }

  return (
    <ul className="space-y-1">
      {conversations.map((conversation) => {
        const isSelected = conversation.id === selectedId
        const latest = latestTurn(conversation.id)
        return (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                isSelected ? 'bg-sky-50 ring-1 ring-sky-200 dark:ring-brand-sky/30' : 'hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${latest ? STATUS_DOT[latest.status] : 'bg-slate-300'}`}
                />
                <p className="truncate text-sm text-slate-800">{conversation.title}</p>
                {scheduledIds?.has(conversation.id) && (
                  <span title="A scheduled task's chat" className="shrink-0 text-slate-400">
                    <ClockIcon className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <p className="mt-1 pl-3.5 text-xs text-slate-400">
                {latest ? `${AGENT_LABELS[latest.agent_type]} · ` : ''}
                {relativeTime(conversation.updated_at)}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
