import type { Tables } from './database.types'
import { supabase } from './supabase'

export type Conversation = Tables<'conversations'>

export function conversationTitle(prompt: string): string {
  const oneLine = prompt.replace(/\s+/g, ' ').trim()
  return oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine || 'New chat'
}

export async function createConversation(userId: string, firstPrompt: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title: conversationTitle(firstPrompt) })
    .select()
    .single()
  return error || !data ? null : data
}
