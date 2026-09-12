import type { Lead, LeadGenerationResult } from '../../lib/salesAgentTypes'

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'bg-green-100 text-green-700'
      : score >= 40
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600'

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      {score}/100
    </span>
  )
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900">{lead.company_name}</h4>
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sky-600 hover:underline"
            >
              {lead.website}
            </a>
          )}
        </div>
        <ScoreBadge score={lead.qualification_score} />
      </div>

      {lead.description && (
        <p className="mt-2 text-sm text-slate-600">{lead.description}</p>
      )}

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {lead.industry && (
          <div>
            <dt className="text-xs text-slate-400">Industry</dt>
            <dd className="text-slate-700">{lead.industry}</dd>
          </div>
        )}
        {lead.location && (
          <div>
            <dt className="text-xs text-slate-400">Location</dt>
            <dd className="text-slate-700">{lead.location}</dd>
          </div>
        )}
        {lead.company_size && (
          <div>
            <dt className="text-xs text-slate-400">Company size</dt>
            <dd className="text-slate-700">{lead.company_size}</dd>
          </div>
        )}
        {lead.potential_pain_point && (
          <div>
            <dt className="text-xs text-slate-400">Potential pain point</dt>
            <dd className="text-slate-700">{lead.potential_pain_point}</dd>
          </div>
        )}
      </dl>

      {lead.why_good_fit && (
        <p className="mt-3 rounded-lg bg-sky-50 p-2.5 text-sm text-sky-900">
          <span className="font-medium">Why a good fit: </span>
          {lead.why_good_fit}
        </p>
      )}

      <p className="mt-3 text-sm text-slate-600">
        <span className="font-medium text-slate-700">Reasoning: </span>
        {lead.reasoning}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {lead.business_email && (
          <a href={`mailto:${lead.business_email}`} className="text-sky-600 hover:underline">
            {lead.business_email}
          </a>
        )}
        {lead.contact_page && (
          <a
            href={lead.contact_page}
            target="_blank"
            rel="noreferrer"
            className="text-sky-600 hover:underline"
          >
            Contact page
          </a>
        )}
        {lead.sources.map((src) => (
          <a
            key={src}
            href={src}
            target="_blank"
            rel="noreferrer"
            className="truncate text-slate-400 hover:text-slate-600 hover:underline"
          >
            source
          </a>
        ))}
      </div>

      {lead.inferred_fields.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Inferred (not directly confirmed): {lead.inferred_fields.join(', ')}
        </p>
      )}
    </div>
  )
}

export default function LeadResultsPanel({ result }: { result: LeadGenerationResult }) {
  return (
    <div>
      <p className="text-xs text-slate-500">
        {result.leads_found} lead{result.leads_found === 1 ? '' : 's'} qualified
        {result.criteria.industry && ` · ${result.criteria.industry}`}
        {result.criteria.geography && ` · ${result.criteria.geography}`}
      </p>
      {result.notes && (
        <p className="mt-1 text-xs text-amber-700">{result.notes}</p>
      )}

      <div className="mt-3 space-y-3">
        {result.leads.map((lead, i) => (
          <LeadCard key={`${lead.company_name}-${i}`} lead={lead} />
        ))}
      </div>
    </div>
  )
}
