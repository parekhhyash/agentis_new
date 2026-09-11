import { Link } from 'react-router-dom'
import authBg from '../assets/auth-bg-login.png'
import AuthLayout from '../components/AuthLayout'
import { GoogleIcon } from '../components/icons'

export default function LoginPage() {
  return (
    <AuthLayout
      image={authBg}
      headline="Welcome back to your AI workforce."
      subtext="Sign in to check in on every agent running your company."
    >
      <h1 className="mt-8 text-2xl font-semibold text-slate-900 lg:mt-0">
        Log in to Agentis
      </h1>
      <p className="mt-2 text-[15px] text-slate-500">
        New here?{' '}
        <Link to="/signup" className="font-medium text-sky-600 hover:text-sky-700">
          Create an account
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
          <label
            htmlFor="login-email"
            className="text-sm font-medium text-slate-700"
          >
            Work email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <a href="#" className="text-sm font-medium text-sky-600 hover:text-sky-700">
              Forgot password?
            </a>
          </div>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-sky-600 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Log in
        </button>
      </form>
    </AuthLayout>
  )
}
