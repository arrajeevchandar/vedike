import type { CompetitionLifecycle, DisplayStatus, PublicationState } from "@/lib/types";

export const VOTE_PRICE_PAISE = 200;
export const VOTE_PRICE_RUPEES = 2;
export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function deriveStatus(input: {
  startsAt: Date | string;
  endsAt: Date | string;
  publicationState?: PublicationState;
  lifecycle?: CompetitionLifecycle;
  isShowcase?: boolean;
  now?: Date;
}): DisplayStatus {
  if (input.isShowcase) return "showcase";
  if (input.lifecycle === "COMPLETED") return "completed";
  const now = input.now ?? new Date();
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (now < start) return "upcoming";
  if (now <= end && input.lifecycle !== "CLOSING") return "live";
  return "ended";
}

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateRange(start: Date | string, end: Date | string) {
  return `${formatDateTime(start)} → ${formatDateTime(end)}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw new Error("Enter a valid 10-digit Indian mobile number.");
  return `+91${local}`;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function istInputToUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter a valid date and time.");
  return new Date(`${value}:00+05:30`);
}

export function rankSubmissions<T extends { voteCount: number; lastVoteReachedAt?: Date | string | null; createdAt: Date | string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    const aTie = a.lastVoteReachedAt ? new Date(a.lastVoteReachedAt).getTime() : new Date(a.createdAt).getTime();
    const bTie = b.lastVoteReachedAt ? new Date(b.lastVoteReachedAt).getTime() : new Date(b.createdAt).getTime();
    if (aTie !== bTie) return aTie - bTie;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
