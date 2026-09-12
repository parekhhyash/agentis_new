import { useEffect, useState } from 'react'
import AgentGrid from '../components/dashboard/AgentGrid'
import DashboardTopBar from '../components/dashboard/DashboardTopBar'
import RequestHistory from '../components/dashboard/RequestHistory'
import TaskComposer from '../components/dashboard/TaskComposer'
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

    // Only Sales & Outreach has a real agent behind it right now - other
    // categories just sit in the queue until their agents are built.
    if (agentType !== 'sales_outreach') return

    // Fire-and-forget: a real run takes minutes, so the composer shouldn't
    // stay locked waiting for it. Status updates flow back via updateRequest.
    void runSalesAgent(data.id, prompt)
  }

  const firstName = profile?.full_name.split(' ')[0]

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardTopBar companyName={profile?.company_name ?? null} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl text-slate-900">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        <p className="mt-1 text-slate-500">
          Pick an agent, describe the task, and it lands in your queue below.
        </p>

        <div className="mt-8">
          <TaskComposer
            agentType={agentType}
            onAgentTypeChange={setAgentType}
            onSubmit={handleSubmit}
          />
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Your agents
          </h2>
          <div className="mt-4">
            <AgentGrid selected={agentType} onSelect={setAgentType} />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Recent requests
          </h2>
          <div className="mt-4">
            <RequestHistory requests={requests} loading={loadingRequests} />
          </div>
        </div>
      </main>
    </div>
  )
}
