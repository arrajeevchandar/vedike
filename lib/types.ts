export type PublicationState = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CompetitionLifecycle = "PUBLISHED" | "CLOSING" | "COMPLETED" | "ARCHIVED";
export type SubmissionState = "VISIBLE" | "HIDDEN" | "DISQUALIFIED" | "ARCHIVED";
export type PaymentState =
  | "CREATED"
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REVIEW_REQUIRED";
export type DisplayStatus = "live" | "upcoming" | "ended" | "completed" | "showcase";

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  glyph: string;
  banner: string;
  bannerUrl?: string | null;
  startsAt: string;
  endsAt: string;
  status: DisplayStatus;
  competitionCount: number;
  isShowcase: boolean;
}

export interface PublicCompetition {
  id: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  slug: string;
  title: string;
  description: string;
  rules: string[];
  glyph: string;
  banner: string;
  bannerUrl?: string | null;
  startsAt: string;
  endsAt: string;
  status: DisplayStatus;
  submissionCount: number;
  voteCount: number;
  maxEntriesPerParticipant: number | null;
  isShowcase: boolean;
  lifecycle?: CompetitionLifecycle;
  winners?: PublicWinner[];
}

export interface PublicSubmission {
  id: string;
  competitionId: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  tile: string;
  glyph: string;
  voteCount: number;
  createdAt: string;
}

export interface PublicWinner extends PublicSubmission {
  rank: number;
  voteCountSnapshot: number;
}

export interface LeaderboardRow extends PublicSubmission {
  rank: number;
  percentage: number;
}

export interface CompetitionDetail extends PublicCompetition {
  submissions: PublicSubmission[];
  leaderboard: LeaderboardRow[];
}
