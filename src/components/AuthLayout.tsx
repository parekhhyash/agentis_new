import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export default function AuthLayout({
  image,
  headline,
  subtext,
  children,
}: {
  image: string
  headline: string
  subtext: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <div
        className="relative hidden w-1/2 bg-cover bg-center lg:block"
        style={{ backgroundImage: `url(${image})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />

        <Link
          to="/"
          className="font-display absolute top-8 left-8 text-2xl text-white"
        >
          Agentis
        </Link>

        <div className="absolute bottom-16 left-8 max-w-md pr-8">
          <h2 className="font-display text-balance text-3xl text-white sm:text-4xl">
            {headline}
          </h2>
          <p className="mt-4 text-lg text-white/85">{subtext}</p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <Link
          to="/"
          className="font-display self-start text-2xl text-slate-900 lg:hidden"
        >
          Agentis
        </Link>

        <div className="mx-auto w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
