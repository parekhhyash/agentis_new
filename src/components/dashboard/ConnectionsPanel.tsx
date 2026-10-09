import type { ReactNode } from 'react'

import { CONNECTORS, type ConnectorInfo } from '../../lib/connectors'
import type { GoogleStatus } from '../../lib/googleConnection'
import { GoogleIcon } from '../icons'
import DataFilesPanel from './DataFilesPanel'

function Tile({ connector }: { connector: ConnectorInfo }) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold ${connector.tile}`}
    >
      {connector.id === 'google' ? <GoogleIcon className="h-5 w-5" /> : connector.monogram}
    </span>
  )
}

function Card({ connector, children }: { connector: ConnectorInfo; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-surface p-5">
      <div className="flex items-start gap-3">
        <Tile connector={connector} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{connector.name}</h3>
          <p className="text-xs text-slate-500">Used by {connector.usedBy}</p>
        </div>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{connector.description}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export default function ConnectionsPanel({
  google,
  notice,
}: {
  google: {
    status: GoogleStatus | null
    error: string | null
    busy: boolean
    connect: () => void
    disconnect: () => void
  }
  notice: ReactNode
}) {
  const [googleConnector, ...others] = CONNECTORS
  const status = google.status

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl text-slate-900">Connect</h1>
      <p className="mt-2 text-slate-500">
        Give your agents access to the apps you already use. Each person connects their own account, and you
        approve anything an agent sends.
      </p>

      {notice && <div className="mt-6">{notice}</div>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card connector={googleConnector}>
          {!status ? (
            <p className="text-sm text-slate-400">{google.error ?? 'Checking…'}</p>
          ) : !status.configured ? (
            <p className="text-sm text-amber-700">Not set up on the server yet.</p>
          ) : status.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate">{status.email}</span>
              </span>
              <button
                type="button"
                onClick={google.disconnect}
                disabled={google.busy}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={google.connect}
              disabled={google.busy}
              className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {google.busy ? 'Opening Google…' : 'Connect'}
            </button>
          )}
        </Card>

        {others.map((connector) => (
          <Card key={connector.id} connector={connector}>
            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              Coming soon
            </span>
          </Card>
        ))}
      </div>

      <DataFilesPanel />
    </div>
  )
}
