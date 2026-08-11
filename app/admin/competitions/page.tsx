import { AdminPage } from "@/components/admin/admin-page";
import { CompetitionScheduleForm } from "@/components/admin/competition-schedule-form";
import {
  archiveCompetitionAction,
  closeVotingAction,
  publishCompetitionResultsAction,
} from "@/app/admin/actions";
import { getDashboardData } from "@/lib/data";
import { CompetitionReleaseDialog } from "@/components/admin/competition-release-dialog";
import { type EventScheduleOption, utcToIstInput } from "@/lib/admin-schedule";

export default async function AdminCompetitionsPage() {
  const data = await getDashboardData();
  const eventOptions: EventScheduleOption[] = data.events
    .filter((event) => !event.isShowcase && (!("publicationState" in event) || event.publicationState === "PUBLISHED"))
    .map((event) => ({ id: event.id, title: event.title, startsAt: utcToIstInput(event.startsAt), endsAt: utcToIstInput(event.endsAt) }));
  return (
    <AdminPage>
      <div className="eyebrow">Content management</div>
      <h1 className="page-title" style={{ fontSize: 48 }}>Competitions</h1>
      <details className="glass" open style={{ borderRadius: 18, padding: 22, marginBottom: 25 }}>
        <summary className="display" style={{ fontWeight: 700, cursor: "pointer" }}>+ Create Competition</summary>
        {eventOptions.length ? <CompetitionScheduleForm events={eventOptions} /> : <p className="muted">Create a real event first; showcase events stay read-only.</p>}
      </details>
      <div style={{ display: "grid", gap: 12 }}>
        {data.competitions.map((competition) => (
          <article key={competition.id} className="glass" style={{ padding: 18, borderRadius: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <b className="display">{competition.title}</b>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {competition.isShowcase ? "Showcase · payments disabled" : `${competition.lifecycle} · ${competition.maxEntriesPerParticipant ?? "Unlimited"} entries per participant`}
                </div>
              </div>
              {!competition.isShowcase && <form action={archiveCompetitionAction}><input type="hidden" name="id" value={competition.id} /><button className="btn btn-secondary" style={{ padding: "8px 14px", color: "#ff8a8f" }}>Archive</button></form>}
            </div>
            {!competition.isShowcase && competition.lifecycle === "APPLICATIONS_OPEN" && (
              <CompetitionReleaseDialog
                competitionId={competition.id}
                competitionTitle={competition.title}
                entries={data.submissions.filter((submission) => submission.competitionId === competition.id && "state" in submission && submission.state === "PENDING_REVIEW").map((submission) => ({ id: submission.id, name: "participantName" in submission ? submission.participantName : submission.name, description: submission.description }))}
                visibleEntryCount={data.submissions.filter((submission) => submission.competitionId === competition.id && "state" in submission && submission.state === "VISIBLE").length}
              />
            )}
            {!competition.isShowcase && competition.lifecycle === "VOTING_OPEN" && (
              <form action={closeVotingAction} style={{ marginTop: 14 }}><input type="hidden" name="id" value={competition.id} /><button className="btn btn-secondary" style={{ padding: "8px 14px", color: "var(--gold)", borderColor: "rgba(242, 183, 5, .4)" }}>Close voting</button></form>
            )}
            {!competition.isShowcase && competition.lifecycle === "CLOSING" && (
              <form action={publishCompetitionResultsAction} style={{ marginTop: 14 }}><input type="hidden" name="id" value={competition.id} /><button className="btn btn-primary" style={{ padding: "8px 14px" }}>Publish results</button></form>
            )}
            {!competition.isShowcase && competition.lifecycle === "APPLICATIONS_OPEN" && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: "pointer", color: "var(--gold)" }}>Edit competition</summary>
                <CompetitionScheduleForm
                  events={eventOptions}
                  competition={{
                    id: competition.id,
                    eventId: competition.eventId,
                    title: competition.title,
                    description: competition.description,
                    rules: competition.rules.join("\n"),
                    applicationStartsAt: utcToIstInput(competition.applicationStartsAt ?? competition.startsAt),
                    applicationEndsAt: utcToIstInput(competition.applicationEndsAt ?? competition.startsAt),
                    votingStartsAt: utcToIstInput(competition.votingStartsAt ?? competition.startsAt),
                    votingEndsAt: utcToIstInput(competition.votingEndsAt ?? competition.endsAt),
                    maxEntries: competition.maxEntriesPerParticipant,
                  }}
                />
              </details>
            )}
          </article>
        ))}
      </div>
    </AdminPage>
  );
}
