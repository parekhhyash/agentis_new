import { useEffect, useState } from 'react'
import ChatConversation from '../components/dashboard/ChatConversation'
import DashboardTopBar from '../components/dashboard/DashboardTopBar'
import RequestSidebar from '../components/dashboard/RequestSidebar'
import TaskComposer from '../components/dashboard/TaskComposer'
import { CloseIcon, MenuIcon, PlusIcon } from '../components/icons'
import type { AgentType } from '../lib/agentTypes'
import { useAuth } from '../lib/AuthContext'
import type { Json, Tables } from '../lib/database.types'
import { generateLeads, SalesAgentApiError } from '../lib/salesAgentApi'
import { supabase } from '../lib/supabase'

type AgentRequest = Tables<'agent_requests'>

export default function DashboardPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [requests, setRequests] = useState<AgentRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [agentType, setAgentType] = useState<AgentType>('sales_outreach')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!user) return

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data))

    supabase
      .from('agent_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRequests(data ?? [])
        setLoadingRequests(false)
        setSelectedId((current) => current ?? data?.[0]?.id ?? null)
      })
  }, [user])

  function updateRequest(id: string, patch: Partial<AgentRequest>) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function runSalesAgent(requestId: string, prompt: string) {
    await supabase.from('agent_requests').update({ status: 'in_progress' }).eq('id', requestId)
    updateRequest(requestId, { status: 'in_progress' })

    try {
      const result = await generateLeads(prompt)
      await supabase
        .from('agent_requests')
        .update({ status: 'completed', result: result as unknown as Json })
        .eq('id', requestId)
      updateRequest(requestId, { status: 'completed', result: result as unknown as Json })
    } catch (err) {
      const message =
        err instanceof SalesAgentApiError ? err.message : 'Unexpected error running the agent.'
      await supabase
        .from('agent_requests')
        .update({ status: 'failed', error: message })
        .eq('id', requestId)
      updateRequest(requestId, { status: 'failed', error: message })
    }
  }

  async function handleSubmit(prompt: string) {
    if (!user) return

    const { data, error } = await supabase
      .from('agent_requests')
      .insert({ user_id: user.id, agent_type: agentType, prompt })
      .select()
      .single()

    if (error || !data) return
    setRequests((prev) => [data, ...prev])
    setSelectedId(data.id)

    // Only Sales & Outreach has a real agent behind it right now - other
    // categories just sit in the queue until their agents are built.
    if (agentType !== 'sales_outreach') return

    // Fire-and-forget: a real run takes minutes, so the composer shouldn't
    // stay locked waiting for it. Status updates flow back via updateRequest.
    void runSalesAgent(data.id, prompt)
  }

  function selectRequest(id: string | null) {
    setSelectedId(id)
    setSidebarOpen(false)
  }

  const firstName = profile?.full_name.split(' ')[0]
  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <DashboardTopBar companyName={profile?.company_name ?? null} />

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-slate-900/20 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`absolute inset-y-0 left-0 z-20 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out sm:static sm:z-auto sm:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-3">
            <button
              type="button"
              onClick={() => selectRequest(null)}
              className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <PlusIcon className="text-slate-500" />
              New chat
            </button>
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:hidden"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            <RequestSidebar
              requests={requests}
              loading={loadingRequests}
              selectedId={selectedId}
              onSelect={selectRequest}
            />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3 sm:hidden">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <MenuIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {selectedRequest ? (
              <div className="mx-auto max-w-3xl px-6 py-8">
                <ChatConversation request={selectedRequest} />
              </div>
            ) : (
              <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 text-center">
                <h1 className="font-display text-3xl text-slate-900">
                  {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
                </h1>
                <p className="mt-2 text-slate-500">
                  Pick an agent below, describe the task, and it'll show up here like a
                  conversation.
                </p>
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-3xl px-6 pb-6">
            <TaskComposer
              agentType={agentType}
              onAgentTypeChange={setAgentType}
              onSubmit={handleSubmit}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
