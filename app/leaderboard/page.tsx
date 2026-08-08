import { PublicShell } from "@/components/public/public-shell";
import { LiveLeaderboard } from "@/components/public/leaderboard";
import { getCompetition, getCompetitions } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const competitions = await getCompetitions();
  const selected = competitions.find((competition) => competition.phase === "completed" && competition.submissionCount > 0);
  const detail = selected ? await getCompetition(selected.slug) : null;
  return <PublicShell><div className="shell page-pad"><div className="eyebrow">Results · Rankings</div><h1 className="page-title">Community <span className="gradient-text">Leaderboard</span></h1><p className="muted">Verified rankings appear here after an organiser publishes a competition’s results.</p>{detail ? <div style={{ marginTop: 35 }}><h2 className="display">{detail.title}</h2><LiveLeaderboard slug={detail.slug} initial={detail.leaderboard} /></div> : <div className="empty">No published competition results yet.</div>}</div></PublicShell>;
}
