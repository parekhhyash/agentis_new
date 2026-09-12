import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

export default function DashboardTopBar({
  companyName,
}: {
  companyName: string | null
}) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="font-display text-xl text-slate-900">Agentis</span>

        <div className="flex items-center gap-4">
          {companyName && (
            <span className="hidden text-sm text-slate-500 sm:inline">
              {companyName}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
