import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useProfile } from '../lib/useProfile'

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+']

export default function CompanySetupPage() {
  const { user } = useAuth()
  const { profile, loading, setProfile } = useProfile()
  const navigate = useNavigate()

  const [companyName, setCompanyName] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [industry, setIndustry] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [companyDescription, setCompanyDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && profile?.onboarding_completed) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    const name = companyName.trim()
    if (!name) {
      setError('Company name is required.')
      return
    }

    setSubmitting(true)
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({
        company_name: name,
        company_website: companyWebsite.trim() || null,
        industry: industry.trim() || null,
        company_size: companySize || null,
        company_description: companyDescription.trim() || null,
        onboarding_completed: true,
      })
      .eq('id', user.id)
      .select()
      .single()

    setSubmitting(false)

    if (updateError || !data) {
      setError('Something went wrong saving your details. Please try again.')
      return
    }

    setProfile(data)
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-lg">
        <span className="font-display text-xl text-slate-900">Agentis</span>

        <h1 className="mt-6 font-display text-3xl text-slate-900">Set up your company</h1>
        <p className="mt-2 text-[15px] text-slate-500">
          This context is shared with your agents so their work fits your business - you
          can change it anytime.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>
          )}

          <div>
            <label htmlFor="company-name" className="text-sm font-medium text-slate-700">
              Company name
            </label>
            <input
              id="company-name"
              type="text"
              required
              autoComplete="organization"
              placeholder="Acme Inc."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="company-website" className="text-sm font-medium text-slate-700">
              Company website
            </label>
            <input
              id="company-website"
              type="url"
              autoComplete="url"
              placeholder="https://acme.com"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="industry" className="text-sm font-medium text-slate-700">
                Industry
              </label>
              <input
                id="industry"
                type="text"
                placeholder="E-commerce, SaaS, Healthcare..."
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="company-size" className="text-sm font-medium text-slate-700">
                Company size
              </label>
              <select
                id="company-size"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              >
                <option value="">Select...</option>
                {COMPANY_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} employees
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="company-description" className="text-sm font-medium text-slate-700">
              What does your company do?
            </label>
            <textarea
              id="company-description"
              rows={4}
              placeholder="What you sell, who your customers are, and anything else that would help an agent represent your business well."
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-sky-600 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
