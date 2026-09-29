from agents.lead_research.schemas import ICPSummary, LeadResearchResult
from agents.lead_research.state import ResearchState


class ResultFormatter:
    @staticmethod
    def format(state: ResearchState) -> LeadResearchResult:
        icp = state.icp
        requested = state.budget.requested_leads
        leads = state.final_leads

        notes: list[str] = []
        if len(leads) < requested:
            shortfall = f"Found {len(leads)} qualified lead{'' if len(leads) == 1 else 's'} of the {requested} requested"
            notes.append(f"{shortfall} - {state.stop_reason}." if state.stop_reason else f"{shortfall}.")
        notes.extend(state.notes)

        state.usage.runtime_seconds = round(state.elapsed(), 1)
        state.usage.search_cost_usd = round(state.usage.search_cost_usd, 4)
        return LeadResearchResult(
            query=state.objective,
            icp=ICPSummary(
                summary=icp.summary if icp else "",
                industries=icp.industries if icp else [],
                geographies=icp.geographies if icp else [],
                company_size=icp.company_size if icp else None,
                target_roles=icp.target_roles if icp else [],
                signals=icp.signals if icp else [],
            ),
            requested_leads=requested,
            leads_found=len(leads),
            leads=leads,
            notes=" ".join(notes) or None,
            usage=state.usage,
        )
