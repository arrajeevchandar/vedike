import { AdminPage } from "@/components/admin/admin-page";
import {
  archiveCompetitionAction,
  saveCompetitionAction,
} from "@/app/admin/actions";
import { getDashboardData } from "@/lib/data";

function toIstInput(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function CompetitionFields({
  events,
  competition,
}: {
  events: Awaited<ReturnType<typeof getDashboardData>>["events"];
  competition?: Awaited<ReturnType<typeof getDashboardData>>["competitions"][number];
}) {
  const realEvents = events.filter(
    (event) =>
      !event.isShowcase &&
      (!("publicationState" in event) || event.publicationState !== "ARCHIVED"),
  );
  return (
    <>
      {competition && <input type="hidden" name="id" value={competition.id} />}
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Parent event</label>
      <select className="field" name="eventId" required defaultValue={competition?.eventId} style={{ gridColumn: "1/-1" }}>
        {realEvents.map((event) => <option value={event.id} key={event.id}>{event.title}</option>)}
      </select>
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Title</label>
      <input className="field" name="title" required defaultValue={competition?.title} style={{ gridColumn: "1/-1" }} />
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Description</label>
      <textarea className="field" name="description" rows={3} required defaultValue={competition?.description} style={{ gridColumn: "1/-1" }} />
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Rules (one per line)</label>
      <textarea className="field" name="rules" rows={3} defaultValue={competition?.rules.join("\n")} style={{ gridColumn: "1/-1" }} />
      <div><label className="form-label">Starts (IST)</label><input className="field" type="datetime-local" name="startsAt" required defaultValue={competition ? toIstInput(competition.startsAt) : undefined} /></div>
      <div><label className="form-label">Ends (IST)</label><input className="field" type="datetime-local" name="endsAt" required defaultValue={competition ? toIstInput(competition.endsAt) : undefined} /></div>
      <div><label className="form-label">Entry limit</label><input className="field" type="number" min="1" max="100" name="maxEntries" defaultValue={competition?.maxEntriesPerParticipant ?? ""} placeholder="Unlimited" /></div>
    </>
  );
}

export default async function AdminCompetitionsPage() {
  const data = await getDashboardData();
  const canCreate = data.events.some(
    (event) =>
      !event.isShowcase &&
      (!("publicationState" in event) || event.publicationState !== "ARCHIVED"),
  );
  return (
    <AdminPage>
      <div className="eyebrow">Content management</div>
      <h1 className="page-title" style={{ fontSize: 48 }}>Competitions</h1>
      <details className="glass" open style={{ borderRadius: 18, padding: 22, marginBottom: 25 }}>
        <summary className="display" style={{ fontWeight: 700, cursor: "pointer" }}>+ Create Competition</summary>
        {canCreate ? (
          <form action={saveCompetitionAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginTop: 14 }}>
            <CompetitionFields events={data.events} />
            <button className="btn btn-primary" style={{ gridColumn: "1/-1", marginTop: 18 }}>Create Competition</button>
          </form>
        ) : <p className="muted">Create a real event first; showcase events stay read-only.</p>}
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
            {!competition.isShowcase && competition.lifecycle === "PUBLISHED" && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: "pointer", color: "var(--gold)" }}>Edit competition</summary>
                <form action={saveCompetitionAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginTop: 14 }}>
                  <CompetitionFields events={data.events} competition={competition} />
                  <button className="btn btn-secondary" style={{ gridColumn: "1/-1", marginTop: 12 }}>Save changes</button>
                </form>
              </details>
            )}
          </article>
        ))}
      </div>
    </AdminPage>
  );
}
