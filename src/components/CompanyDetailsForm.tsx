import { COUNTRIES } from '../lib/countries'

export type CompanyDetailsValues = {
  companyName: string
  companyWebsite: string
  industry: string
  targetAudienceLocation: string
  companyDescription: string
}

export function emptyCompanyDetails(): CompanyDetailsValues {
  return {
    companyName: '',
    companyWebsite: '',
    industry: '',
    targetAudienceLocation: '',
    companyDescription: '',
  }
}

export default function CompanyDetailsForm({
  values,
  onChange,
}: {
  values: CompanyDetailsValues
  onChange: (patch: Partial<CompanyDetailsValues>) => void
}) {
  return (
    <>
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
          value={values.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
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
          value={values.companyWebsite}
          onChange={(e) => onChange({ companyWebsite: e.target.value })}
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
            value={values.industry}
            onChange={(e) => onChange({ industry: e.target.value })}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="target-audience-location" className="text-sm font-medium text-slate-700">
            Where are your customers?
          </label>
          <select
            id="target-audience-location"
            value={values.targetAudienceLocation}
            onChange={(e) => onChange({ targetAudienceLocation: e.target.value })}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          >
            <option value="">Select...</option>
            <option value="Global">Global</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
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
          value={values.companyDescription}
          onChange={(e) => onChange({ companyDescription: e.target.value })}
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
        />
      </div>
    </>
  )
}
