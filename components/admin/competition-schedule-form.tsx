"use client";

import { useActionState, useMemo, useState } from "react";
import { saveCompetitionAction } from "@/app/admin/actions";
import {
  addIstMinutes,
  type AdminFormState,
  type CompetitionSchedule,
  type EventScheduleOption,
  formatIstInput,
  reconcileCompetitionSchedule,
  validateCompetitionSchedule,
} from "@/lib/admin-schedule";
import { DateTimePicker } from "./date-time-picker";

const initialState: AdminFormState = { status: "idle" };
const fieldNames: Record<keyof CompetitionSchedule, string> = {
  applicationStartsAt: "application opening",
  applicationEndsAt: "application closing",
  votingStartsAt: "voting opening",
  votingEndsAt: "voting closing",
};

type CompetitionDefaults = CompetitionSchedule & {
  id: string;
  eventId: string;
  title: string;
  description: string;
  rules: string;
  maxEntries: number | null;
};

export function CompetitionScheduleForm({ events, competition }: { events: EventScheduleOption[]; competition?: CompetitionDefaults }) {
  const [state, formAction, pending] = useActionState(saveCompetitionAction, initialState);
  const [eventId, setEventId] = useState(competition?.eventId ?? events[0]?.id ?? "");
  const [schedule, setSchedule] = useState<CompetitionSchedule>({
    applicationStartsAt: competition?.applicationStartsAt ?? "",
    applicationEndsAt: competition?.applicationEndsAt ?? "",
    votingStartsAt: competition?.votingStartsAt ?? "",
    votingEndsAt: competition?.votingEndsAt ?? "",
  });
  const [notice, setNotice] = useState("");
  const event = events.find((option) => option.id === eventId) ?? events[0];
  const errors = useMemo(() => event ? validateCompetitionSchedule(schedule, event) : { applicationStartsAt: "Choose a parent event." }, [schedule, event]);
  const invalid = !event || Object.keys(errors).length > 0;

  const applySchedule = (next: CompetitionSchedule, reason?: string) => {
    if (!event) return setSchedule(next);
    const reconciled = reconcileCompetitionSchedule(next, event);
    setSchedule(reconciled.schedule);
    setNotice(reconciled.cleared.length ? `${reconciled.cleared.map((field) => fieldNames[field]).join(", ")} ${reconciled.cleared.length === 1 ? "was" : "were"} cleared because the new range made the value invalid.` : reason ?? "");
  };

  const changeEvent = (nextEventId: string) => {
    setEventId(nextEventId);
    const nextEvent = events.find((option) => option.id === nextEventId);
    if (!nextEvent) return;
    const reconciled = reconcileCompetitionSchedule(schedule, nextEvent);
    setSchedule(reconciled.schedule);
    setNotice(reconciled.cleared.length ? `Kept the valid times and cleared ${reconciled.cleared.map((field) => fieldNames[field]).join(", ")} for the new event.` : "All selected times fit inside the new event.");
  };

  const change = (field: keyof CompetitionSchedule, value: string) => applySchedule({ ...schedule, [field]: value });
  const fieldError = (field: keyof CompetitionSchedule) => state.fieldErrors?.[field] ?? (schedule[field] ? errors[field] : undefined);
  const rangeHint = event ? `Valid event range: ${formatIstInput(event.startsAt)} — ${formatIstInput(event.endsAt)}.` : "Choose a parent event first.";

  return (
    <form action={formAction} className="admin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginTop: 14 }}>
      {competition && <input type="hidden" name="id" value={competition.id} />}
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Parent event</label>
      <select className="field" name="eventId" required value={eventId} onChange={(event) => changeEvent(event.target.value)} style={{ gridColumn: "1/-1" }}>
        {events.map((option) => <option value={option.id} key={option.id}>{option.title}</option>)}
      </select>
      {event && <p className="admin-schedule-range" style={{ gridColumn: "1/-1" }}>{rangeHint}</p>}
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Title</label>
      <input className="field" name="title" required defaultValue={competition?.title} style={{ gridColumn: "1/-1" }} />
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Description</label>
      <textarea className="field" name="description" rows={3} required defaultValue={competition?.description} style={{ gridColumn: "1/-1" }} />
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Rules (one per line)</label>
      <textarea className="field" name="rules" rows={3} defaultValue={competition?.rules} style={{ gridColumn: "1/-1" }} />
      <div style={{ gridColumn: "1/-1", marginTop: 8 }} className="eyebrow">Application window</div>
      <DateTimePicker name="applicationStartsAt" label="Opens (IST)" value={schedule.applicationStartsAt} onChange={(value) => change("applicationStartsAt", value)} min={event?.startsAt} max={event ? addIstMinutes(event.endsAt, -2) : undefined} required disabled={!event} hint={rangeHint} error={fieldError("applicationStartsAt")} />
      <DateTimePicker name="applicationEndsAt" label="Closes (IST)" value={schedule.applicationEndsAt} onChange={(value) => change("applicationEndsAt", value)} min={schedule.applicationStartsAt ? addIstMinutes(schedule.applicationStartsAt, 1) : undefined} max={event ? addIstMinutes(event.endsAt, -1) : undefined} required disabled={!schedule.applicationStartsAt} hint={schedule.applicationStartsAt ? "Must be at least one minute after applications open." : "Choose when applications open first."} error={fieldError("applicationEndsAt")} />
      <div style={{ gridColumn: "1/-1", marginTop: 8 }} className="eyebrow">Voting window</div>
      <DateTimePicker name="votingStartsAt" label="Opens (IST)" value={schedule.votingStartsAt} onChange={(value) => change("votingStartsAt", value)} min={schedule.applicationEndsAt || undefined} max={event ? addIstMinutes(event.endsAt, -1) : undefined} required disabled={!schedule.applicationEndsAt} hint={schedule.applicationEndsAt ? "May begin at the exact minute applications close." : "Choose when applications close first."} error={fieldError("votingStartsAt")} />
      <DateTimePicker name="votingEndsAt" label="Closes (IST)" value={schedule.votingEndsAt} onChange={(value) => change("votingEndsAt", value)} min={schedule.votingStartsAt ? addIstMinutes(schedule.votingStartsAt, 1) : undefined} max={event?.endsAt} required disabled={!schedule.votingStartsAt} hint={schedule.votingStartsAt ? `Must close by ${formatIstInput(event?.endsAt ?? "")}.` : "Choose when voting opens first."} error={fieldError("votingEndsAt")} />
      <div><label className="form-label">Entry limit</label><input className="field" type="number" min="1" max="100" name="maxEntries" defaultValue={competition?.maxEntries ?? ""} placeholder="Unlimited" /></div>
      {notice && <p className="admin-schedule-notice" role="status" style={{ gridColumn: "1/-1" }}>{notice}</p>}
      {state.message && <p className={state.status === "error" ? "admin-form-error" : "admin-form-success"} role="status" style={{ gridColumn: "1/-1" }}>{state.message}</p>}
      <button className={competition ? "btn btn-secondary" : "btn btn-primary"} disabled={pending || invalid} style={{ gridColumn: "1/-1", marginTop: competition ? 12 : 18, opacity: pending || invalid ? .55 : 1 }}>
        {pending ? "Saving schedule…" : competition ? "Save changes" : "Create Competition"}
      </button>
    </form>
  );
}
