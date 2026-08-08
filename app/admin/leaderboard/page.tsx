import { AdminPage } from "@/components/admin/admin-page";
import {
  closeVotingAction,
  publishCompetitionResultsAction,
} from "@/app/admin/actions";
import { getDashboardData } from "@/lib/data";

export default async function AdminLeaderboardPage() {
  const { competitions } = await getDashboardData();
  return (
    <AdminPage>
      <div className="eyebrow">Result operations</div>
      <h1 className="page-title" style={{ fontSize: 48 }}>Competition results</h1>
      <p className="muted">Close voting to stop new votes without publishing rankings. Publish results only when you are ready to reveal the verified final totals.</p>
      <div style={{ display: "grid", gap: 12, marginTop: 25 }}>
        {competitions.map((competition) => (
          <article className="glass" key={competition.id} style={{ padding: 18, borderRadius: 15, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
            <div>
              <b className="display">{competition.title}</b>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{competition.isShowcase ? "Showcase podium" : competition.lifecycle}</div>
            </div>
            {!competition.isShowcase && competition.lifecycle === "VOTING_OPEN" && <form action={closeVotingAction}><input type="hidden" name="id" value={competition.id} /><button className="btn btn-secondary" style={{ padding: "9px 16px", color: "var(--gold)", borderColor: "rgba(242,183,5,.4)" }}>Close voting</button></form>}
            {!competition.isShowcase && competition.lifecycle === "CLOSING" && <form action={publishCompetitionResultsAction}><input type="hidden" name="id" value={competition.id} /><button className="btn btn-primary" style={{ padding: "9px 16px" }}>Publish results</button></form>}
          </article>
        ))}
      </div>
    </AdminPage>
  );
}
