import { useEffect, useState } from 'react'
import AgentGrid from '../components/dashboard/AgentGrid'
import DashboardTopBar from '../components/dashboard/DashboardTopBar'
import RequestHistory from '../components/dashboard/RequestHistory'
import TaskComposer from '../components/dashboard/TaskComposer'
import type { AgentType } from '../lib/agentTypes'
import { useAuth } from '../lib/AuthContext'
import type { Tables } from '../lib/database.types'
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

  async function handleSubmit(prompt: string) {
    if (!user) return

    const { data, error } = await supabase
      .from('agent_requests')
      .insert({ user_id: user.id, agent_type: agentType, prompt })
      .select()
      .single()

    if (!error && data) {
      setRequests((prev) => [data, ...prev])
    }
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
