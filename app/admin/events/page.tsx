import { AdminPage } from "@/components/admin/admin-page";
import { EventScheduleForm } from "@/components/admin/event-schedule-form";
import { archiveEventAction, completeEventAction } from "@/app/admin/actions";
import { getDashboardData } from "@/lib/data";
import { utcToIstInput } from "@/lib/admin-schedule";

export default async function AdminEventsPage() {
  const { events, competitions } = await getDashboardData();
  return (
    <AdminPage>
      <div className="eyebrow">Content management</div>
      <h1 className="page-title" style={{ fontSize: 48 }}>Events</h1>
      <details className="glass" open style={{ borderRadius: 18, padding: 22, marginBottom: 25 }}>
        <summary className="display" style={{ fontWeight: 700, cursor: "pointer" }}>+ Create Event</summary>
        <EventScheduleForm />
      </details>
      <div style={{ display: "grid", gap: 12 }}>
        {events.map((event) => {
          const activeChildren = competitions.filter((competition) =>
            !competition.isShowcase && competition.eventId === event.id && competition.lifecycle !== "ARCHIVED",
          );
          const earliestChildStart = activeChildren.length
            ? utcToIstInput(activeChildren.reduce((earliest, competition) => new Date(competition.startsAt) < new Date(earliest.startsAt) ? competition : earliest).startsAt)
            : undefined;
          const latestChildEnd = activeChildren.length
            ? utcToIstInput(activeChildren.reduce((latest, competition) => new Date(competition.endsAt) > new Date(latest.endsAt) ? competition : latest).endsAt)
            : undefined;
          return (
            <article key={event.id} className="glass" style={{ padding: 18, borderRadius: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <b className="display">{event.title}</b>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    {event.isShowcase ? "Showcase · read only" : `${new Date(event.startsAt).toLocaleString("en-IN")} → ${new Date(event.endsAt).toLocaleString("en-IN")}`}
                  </div>
                </div>
                {!event.isShowcase && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {("publicationState" in event && event.publicationState === "PUBLISHED") && <form action={completeEventAction}><input type="hidden" name="id" value={event.id} /><button className="btn btn-secondary" style={{ padding: "8px 14px", color: "var(--gold)", borderColor: "rgba(242, 183, 5, .4)" }}>Complete event</button></form>}
                    <form action={archiveEventAction}><input type="hidden" name="id" value={event.id} /><button className="btn btn-secondary" style={{ padding: "8px 14px", color: "#ff8a8f" }}>Archive</button></form>
                  </div>
                )}
              </div>
              {!event.isShowcase && (
                <details style={{ marginTop: 16 }}>
                  <summary style={{ cursor: "pointer", color: "var(--gold)" }}>Edit event</summary>
                  <EventScheduleForm
                    event={{ id: event.id, title: event.title, description: event.description, startsAt: utcToIstInput(event.startsAt), endsAt: utcToIstInput(event.endsAt) }}
                    earliestChildStart={earliestChildStart}
                    latestChildEnd={latestChildEnd}
                  />
                </details>
              )}
            </article>
          );
        })}
      </div>
    </AdminPage>
  );
}
