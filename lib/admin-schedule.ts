export type ScheduleField =
  | "startsAt"
  | "endsAt"
  | "applicationStartsAt"
  | "applicationEndsAt"
  | "votingStartsAt"
  | "votingEndsAt";

export type AdminFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<ScheduleField, string>>;
};

export type EventScheduleOption = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

export type CompetitionSchedule = {
  applicationStartsAt: string;
  applicationEndsAt: string;
  votingStartsAt: string;
  votingEndsAt: string;
};

const IST_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function istInputToMinute(value: string) {
  const match = IST_INPUT.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const timestamp = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return Math.floor(timestamp / 60_000);
}

export function minuteToIstInput(minute: number) {
  const date = new Date(minute * 60_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function addIstMinutes(value: string, amount: number) {
  const minute = istInputToMinute(value);
  return minute === null ? "" : minuteToIstInput(minute + amount);
}

export function laterIstValue(first?: string, second?: string) {
  if (!first) return second;
  if (!second) return first;
  return (istInputToMinute(first) ?? Number.NEGATIVE_INFINITY) >= (istInputToMinute(second) ?? Number.NEGATIVE_INFINITY) ? first : second;
}

export function utcToIstInput(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatIstInput(value: string) {
  const minute = istInputToMinute(value);
  if (minute === null) return "Choose date and time";
  const date = new Date(minute * 60_000);
  return `${new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date)} IST`;
}

function before(left: string, right: string) {
  const a = istInputToMinute(left);
  const b = istInputToMinute(right);
  return a !== null && b !== null && a < b;
}

function outside(value: string, min: string, max: string) {
  const current = istInputToMinute(value);
  const minimum = istInputToMinute(min);
  const maximum = istInputToMinute(max);
  return current === null || minimum === null || maximum === null || current < minimum || current > maximum;
}

export function validateEventSchedule(input: {
  startsAt: string;
  endsAt: string;
  earliestChildStart?: string;
  latestChildEnd?: string;
}) {
  const errors: Partial<Record<ScheduleField, string>> = {};
  if (istInputToMinute(input.startsAt) === null) errors.startsAt = "Choose a valid event start.";
  if (istInputToMinute(input.endsAt) === null) errors.endsAt = "Choose a valid event end.";
  if (!errors.startsAt && !errors.endsAt && !before(input.startsAt, input.endsAt)) {
    errors.endsAt = "Event end must be at least one minute after its start.";
  }
  if (input.earliestChildStart && before(input.earliestChildStart, input.startsAt)) {
    errors.startsAt = "This event already has a competition that begins earlier.";
  }
  if (input.latestChildEnd && before(input.endsAt, input.latestChildEnd)) {
    errors.endsAt = "This event already has a competition that ends later.";
  }
  return errors;
}

export function validateCompetitionSchedule(
  schedule: CompetitionSchedule,
  event: Pick<EventScheduleOption, "startsAt" | "endsAt">,
) {
  const errors: Partial<Record<ScheduleField, string>> = {};
  const labels: Array<[keyof CompetitionSchedule, string]> = [
    ["applicationStartsAt", "Choose when applications open."],
    ["applicationEndsAt", "Choose when applications close."],
    ["votingStartsAt", "Choose when voting opens."],
    ["votingEndsAt", "Choose when voting closes."],
  ];
  for (const [field, message] of labels) {
    if (istInputToMinute(schedule[field]) === null) errors[field] = message;
    else if (outside(schedule[field], event.startsAt, event.endsAt)) {
      errors[field] = "This time must stay inside the selected event.";
    }
  }
  if (istInputToMinute(schedule.applicationStartsAt) !== null && istInputToMinute(schedule.applicationEndsAt) !== null && !before(schedule.applicationStartsAt, schedule.applicationEndsAt)) {
    errors.applicationEndsAt = "Applications must remain open for at least one minute.";
  }
  if (istInputToMinute(schedule.applicationEndsAt) !== null && istInputToMinute(schedule.votingStartsAt) !== null && before(schedule.votingStartsAt, schedule.applicationEndsAt)) {
    errors.votingStartsAt = "Voting cannot begin before applications close.";
  }
  if (istInputToMinute(schedule.votingStartsAt) !== null && istInputToMinute(schedule.votingEndsAt) !== null && !before(schedule.votingStartsAt, schedule.votingEndsAt)) {
    errors.votingEndsAt = "Voting must remain open for at least one minute.";
  }
  return errors;
}

export function reconcileCompetitionSchedule(
  schedule: CompetitionSchedule,
  event: Pick<EventScheduleOption, "startsAt" | "endsAt">,
) {
  const next = { ...schedule };
  const cleared: Array<keyof CompetitionSchedule> = [];
  for (const field of Object.keys(next) as Array<keyof CompetitionSchedule>) {
    if (next[field] && outside(next[field], event.startsAt, event.endsAt)) {
      next[field] = "";
      cleared.push(field);
    }
  }
  if (next.applicationStartsAt && next.applicationEndsAt && !before(next.applicationStartsAt, next.applicationEndsAt)) {
    next.applicationEndsAt = "";
    cleared.push("applicationEndsAt");
  }
  if (next.applicationEndsAt && next.votingStartsAt && before(next.votingStartsAt, next.applicationEndsAt)) {
    next.votingStartsAt = "";
    cleared.push("votingStartsAt");
  }
  if (next.votingStartsAt && next.votingEndsAt && !before(next.votingStartsAt, next.votingEndsAt)) {
    next.votingEndsAt = "";
    cleared.push("votingEndsAt");
  }
  return { schedule: next, cleared: [...new Set(cleared)] };
}
