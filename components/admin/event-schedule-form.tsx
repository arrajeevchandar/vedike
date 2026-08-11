"use client";

import { useActionState, useMemo, useState } from "react";
import { saveEventAction } from "@/app/admin/actions";
import { addIstMinutes, type AdminFormState, formatIstInput, laterIstValue, validateEventSchedule } from "@/lib/admin-schedule";
import { DateTimePicker } from "./date-time-picker";

const initialState: AdminFormState = { status: "idle" };

type EventScheduleFormProps = {
  event?: {
    id: string;
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
  };
  earliestChildStart?: string;
  latestChildEnd?: string;
};

export function EventScheduleForm({ event, earliestChildStart, latestChildEnd }: EventScheduleFormProps) {
  const [state, formAction, pending] = useActionState(saveEventAction, initialState);
  const [startsAt, setStartsAt] = useState(event?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(event?.endsAt ?? "");
  const errors = useMemo(() => validateEventSchedule({ startsAt, endsAt, earliestChildStart, latestChildEnd }), [startsAt, endsAt, earliestChildStart, latestChildEnd]);
  const invalid = Object.keys(errors).length > 0;
  const startHint = earliestChildStart
    ? `Must begin no later than the earliest active competition: ${formatIstInput(earliestChildStart)}.`
    : "All event and competition times use India Standard Time.";
  const endHint = latestChildEnd
    ? `Must end no earlier than the latest active competition: ${formatIstInput(latestChildEnd)}.`
    : startsAt ? `Earliest valid end: ${formatIstInput(addIstMinutes(startsAt, 1))}.` : "Choose the event start first.";

  return (
    <form action={formAction} className="admin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginTop: 14 }}>
      {event && <input type="hidden" name="id" value={event.id} />}
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Title</label>
      <input className="field" name="title" required defaultValue={event?.title} style={{ gridColumn: "1/-1" }} />
      <label className="form-label" style={{ gridColumn: "1/-1" }}>Description</label>
      <textarea className="field" name="description" rows={3} required defaultValue={event?.description} style={{ gridColumn: "1/-1" }} />
      <DateTimePicker name="startsAt" label="Starts (IST)" value={startsAt} onChange={setStartsAt} max={earliestChildStart} required hint={startHint} error={state.fieldErrors?.startsAt ?? (startsAt ? errors.startsAt : undefined)} />
      <DateTimePicker name="endsAt" label="Ends (IST)" value={endsAt} onChange={setEndsAt} min={laterIstValue(startsAt ? addIstMinutes(startsAt, 1) : undefined, latestChildEnd)} hint={endHint} error={state.fieldErrors?.endsAt ?? (endsAt ? errors.endsAt : undefined)} required disabled={!startsAt} />
      {state.message && <p className={state.status === "error" ? "admin-form-error" : "admin-form-success"} role="status" style={{ gridColumn: "1/-1" }}>{state.message}</p>}
      <button className={event ? "btn btn-secondary" : "btn btn-primary"} disabled={pending || invalid} style={{ gridColumn: "1/-1", marginTop: event ? 12 : 18, opacity: pending || invalid ? .55 : 1 }}>
        {pending ? "Saving schedule…" : event ? "Save changes" : "Create Event"}
      </button>
    </form>
  );
}
