import { AdminPage } from "@/components/admin/admin-page";
import { archiveEventAction, saveEventAction } from "@/app/admin/actions";
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

export default async function AdminEventsPage() {
  const { events } = await getDashboardData();
  return (
    <AdminPage>
      <div className="eyebrow">Content management</div>
      <h1 className="page-title" style={{ fontSize: 48 }}>Events</h1>
      <details className="glass" open style={{ borderRadius: 18, padding: 22, marginBottom: 25 }}>
        <summary className="display" style={{ fontWeight: 700, cursor: "pointer" }}>+ Create Event</summary>
        <form action={saveEventAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginTop: 14 }}>
          <label className="form-label" style={{ gridColumn: "1/-1" }}>Title</label>
          <input className="field" name="title" required style={{ gridColumn: "1/-1" }} />
          <label className="form-label" style={{ gridColumn: "1/-1" }}>Description</label>
          <textarea className="field" name="description" rows={3} required style={{ gridColumn: "1/-1" }} />
          <div><label className="form-label">Starts (IST)</label><input className="field" type="datetime-local" name="startsAt" required /></div>
          <div><label className="form-label">Ends (IST)</label><input className="field" type="datetime-local" name="endsAt" required /></div>
          <button className="btn btn-primary" style={{ gridColumn: "1/-1", marginTop: 18 }}>Create Event</button>
        </form>
      </details>
      <div style={{ display: "grid", gap: 12 }}>
        {events.map((event) => (
          <article key={event.id} className="glass" style={{ padding: 18, borderRadius: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <b className="display">{event.title}</b>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {event.isShowcase ? "Showcase · read only" : `${new Date(event.startsAt).toLocaleString("en-IN")} → ${new Date(event.endsAt).toLocaleString("en-IN")}`}
                </div>
              </div>
              {!event.isShowcase && <form action={archiveEventAction}><input type="hidden" name="id" value={event.id} /><button className="btn btn-secondary" style={{ padding: "8px 14px", color: "#ff8a8f" }}>Archive</button></form>}
            </div>
            {!event.isShowcase && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: "pointer", color: "var(--gold)" }}>Edit event</summary>
                <form action={saveEventAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginTop: 14 }}>
                  <input type="hidden" name="id" value={event.id} />
                  <label className="form-label" style={{ gridColumn: "1/-1" }}>Title</label>
                  <input className="field" name="title" required defaultValue={event.title} style={{ gridColumn: "1/-1" }} />
                  <label className="form-label" style={{ gridColumn: "1/-1" }}>Description</label>
                  <textarea className="field" name="description" rows={3} required defaultValue={event.description} style={{ gridColumn: "1/-1" }} />
                  <div><label className="form-label">Starts (IST)</label><input className="field" type="datetime-local" name="startsAt" required defaultValue={toIstInput(event.startsAt)} /></div>
                  <div><label className="form-label">Ends (IST)</label><input className="field" type="datetime-local" name="endsAt" required defaultValue={toIstInput(event.endsAt)} /></div>
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
