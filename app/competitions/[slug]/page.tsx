import { notFound } from "next/navigation";
import { CompetitionActions } from "@/components/public/competition-actions";
import { LiveLeaderboard } from "@/components/public/leaderboard";
import { PublicShell } from "@/components/public/public-shell";
import { StatusBadge } from "@/components/public/status-badge";
import { SubmissionCard } from "@/components/public/cards";
import { formatDateRange } from "@/lib/domain";
import { getCompetition } from "@/lib/data";

const phaseCopy = {
  applications_upcoming: "Applications open soon",
  applications_open: "Applications are open",
  review: "Entries are under review",
  voting_open: "Community voting is live",
  closing: "Voting has closed",
  completed: "Winners revealed",
  showcase: "Showcase presentation",
  archived: "Competition archived",
} as const;

export default async function CompetitionPage({ params }: PageProps<"/competitions/[slug]">) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition) notFound();
  const phase = competition.phase ?? (competition.isShowcase ? "showcase" : "review");
  const showEntries = competition.isShowcase || ["voting_open", "closing", "completed"].includes(phase);
  const showResults = competition.isShowcase || phase === "completed";
  const completed = phase === "completed" || competition.isShowcase;

  return <PublicShell><div className="shell page-pad">
    <StatusBadge status={competition.status} />
    <div className="phase-banner glass">
      <div className="eyebrow">Competition phase</div>
      <strong className="display">{phaseCopy[phase]}</strong>
      <p className="muted">Applications: {formatDateRange(competition.applicationStartsAt ?? competition.startsAt, competition.applicationEndsAt ?? competition.startsAt)}<br />Voting: {formatDateRange(competition.votingStartsAt ?? competition.startsAt, competition.votingEndsAt ?? competition.endsAt)}</p>
    </div>
    <div className="competition-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(270px,340px)", gap: 40, alignItems: "start", marginTop: 14 }}>
      <div><h1 className="page-title">{competition.title}</h1><p className="muted" style={{ fontSize: 17, lineHeight: 1.7 }}>{competition.description}</p><div className="glass" style={{ padding: 22, borderRadius: 18, marginTop: 28 }}><div className="eyebrow">Competition rules</div><ol style={{ paddingLeft: 20, color: "var(--muted)", lineHeight: 1.8 }}>{competition.rules.map((rule) => <li key={rule}>{rule}</li>)}</ol></div></div>
      <aside className="glass" style={{ padding: 22, borderRadius: 20, position: "sticky", top: 92 }}>
        {showResults ? <><div className="eyebrow">Final leaderboard</div><h3 className="display" style={{ fontSize: 24, margin: "8px 0 18px" }}>{competition.voteCount.toLocaleString("en-IN")} verified votes</h3><LiveLeaderboard slug={slug} initial={competition.leaderboard.slice(0, 5)} /></> : <><div className="eyebrow">Community stage</div><h3 className="display" style={{ fontSize: 24, margin: "8px 0" }}>{phaseCopy[phase]}</h3><p className="muted">Vote totals and rankings remain private until results are published.</p></>}
        <div style={{ marginTop: 18 }}><CompetitionActions competition={competition} /></div>
      </aside>
    </div>
    {completed && competition.winners?.length ? <section style={{ marginTop: 70, textAlign: "center" }}><div className="eyebrow kannada">ವಿಜೇತರು · Winners</div><h2 className="display" style={{ fontSize: 44, margin: "10px 0 30px" }}>The Podium</h2><div style={{ display: "flex", alignItems: "end", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>{competition.winners.map((winner) => <div className="glass" key={winner.id} style={{ order: winner.rank === 1 ? 2 : winner.rank === 2 ? 1 : 3, width: 220, minHeight: winner.rank === 1 ? 280 : winner.rank === 2 ? 235 : 205, borderRadius: "22px 22px 0 0", padding: 22, display: "flex", flexDirection: "column", justifyContent: "end", boxShadow: `0 0 45px ${winner.rank === 1 ? "rgba(242,183,5,.25)" : "rgba(255,255,255,.08)"}` }}><span style={{ fontSize: 40 }}>{["🥇", "🥈", "🥉"][winner.rank - 1]}</span><h3 className="display">{winner.name}</h3><b style={{ color: "var(--gold)" }}>{winner.voteCountSnapshot} votes</b></div>)}</div></section> : null}
    <section style={{ marginTop: 75 }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}><div><div className="eyebrow">{showEntries ? "Community gallery" : "Private review period"}</div><h2 className="display" style={{ fontSize: 38, margin: "8px 0 0" }}>{showEntries ? "Participant Entries" : phase === "applications_open" ? "Your entry belongs here" : phaseCopy[phase]}</h2></div>{phase === "applications_open" && <CompetitionActions competition={competition} />}</div>
      {showEntries ? competition.submissions.length ? <div className="card-grid">{competition.submissions.map((submission) => <SubmissionCard key={submission.id} submission={submission}><CompetitionActions competition={competition} submission={submission} /></SubmissionCard>)}</div> : <div className="empty">No released entries yet.</div> : <div className="empty">{phase === "applications_open" ? "Submit your entry. It will be reviewed privately before public voting begins." : phase === "applications_upcoming" ? "Applications will open at the scheduled time." : "The organiser is reviewing entries before the public voting reveal."}</div>}
    </section>
  </div></PublicShell>;
}
