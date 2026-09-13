import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { ChevronDownIcon } from '../icons'

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return initials || '?'
}

export default function ProfileMenu({
  fullName,
  email,
}: {
  fullName: string
  email: string | null
}) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="relative border-t border-slate-100 p-2">
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-2 z-20 mb-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/company-settings')
              }}
              className="block w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Company settings
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="block w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Log out
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
          {initialsFor(fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">{fullName}</span>
          {email && <span className="block truncate text-xs text-slate-400">{email}</span>}
        </span>
        <ChevronDownIcon className="shrink-0 text-slate-400" />
      </button>
    </div>
  )
}
