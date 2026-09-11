import { Link } from 'react-router-dom'
import authBg from '../assets/auth-bg-signup.png'
import AuthLayout from '../components/AuthLayout'
import { GoogleIcon } from '../components/icons'

export default function SignupPage() {
  return (
    <AuthLayout
      image={authBg}
      headline="Run your company with a team that never sleeps."
      subtext="Create your account and put your first AI agent to work today."
    >
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 lg:mt-0">
        Create your account
      </h1>
      <p className="mt-2 text-[15px] text-slate-500">
        Already on Agentis?{' '}
        <Link to="/login" className="font-medium text-sky-600 hover:text-sky-700">
          Log in
        </Link>
      </p>

      <button
        type="button"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 py-2.5 text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400 uppercase">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="full-name" className="text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="full-name"
            type="text"
            autoComplete="name"
            placeholder="Alex Morgan"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="company-name" className="text-sm font-medium text-slate-700">
            Company name
          </label>
          <input
            id="company-name"
            type="text"
            autoComplete="organization"
            placeholder="Acme Inc."
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="signup-email" className="text-sm font-medium text-slate-700">
            Work email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="signup-password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-sky-600 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Create account
        </button>

        <p className="text-center text-xs text-slate-400">
          By creating an account, you agree to Agentis's Terms of Service and
          Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  )
}
