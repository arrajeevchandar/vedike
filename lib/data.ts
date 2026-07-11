import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { competitions, competitionWinners, events, submissions, voteOrders } from "@/db/schema";
import { getDb, hasDatabase } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { deriveStatus, rankSubmissions } from "@/lib/domain";
import { getShowcaseCompetition, showcaseCompetitions, showcaseEvents, showcaseSubmissions } from "@/lib/showcase-data";
import type { CompetitionDetail, PublicCompetition, PublicEvent, PublicSubmission } from "@/lib/types";

export async function getEvents(): Promise<PublicEvent[]> {
  if (!hasDatabase()) return showcaseEvents;
  const db = getDb();
  const rows = await db.select().from(events).where(eq(events.publicationState, "PUBLISHED")).orderBy(asc(events.startsAt));
  const compRows = await db.select({ eventId: competitions.eventId }).from(competitions).where(and(inArray(competitions.eventId, rows.map((r) => r.id)), ne(competitions.lifecycle, "ARCHIVED")));
  return rows.map((row) => ({
    ...row,
    startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(),
    status: row.isShowcase ? "showcase" : deriveStatus(row),
    competitionCount: compRows.filter((c) => c.eventId === row.id).length,
  }));
}

export async function getEvent(slug: string) {
  if (!hasDatabase()) {
    const event = showcaseEvents.find((item) => item.slug === slug);
    return event ? { ...event, competitions: showcaseCompetitions.filter((item) => item.eventId === event.id) } : null;
  }
  const db = getDb();
  const [event] = await db.select().from(events).where(and(eq(events.slug, slug), eq(events.publicationState, "PUBLISHED"))).limit(1);
  if (!event) return null;
  const comps = await db.select().from(competitions).where(and(eq(competitions.eventId, event.id), ne(competitions.lifecycle, "ARCHIVED"))).orderBy(asc(competitions.startsAt));
  const decorated = await Promise.all(comps.map((c) => decorateCompetition(c, event)));
  return {
    ...event,
    startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString(), status: event.isShowcase ? "showcase" : deriveStatus(event),
    competitionCount: comps.length,
    competitions: decorated,
  };
}

export async function getCompetitions(): Promise<PublicCompetition[]> {
  if (!hasDatabase()) return showcaseCompetitions;
  const db = getDb();
  const rows = await db.select({ competition: competitions, event: events }).from(competitions).innerJoin(events, eq(competitions.eventId, events.id)).where(and(eq(events.publicationState, "PUBLISHED"), ne(competitions.lifecycle, "ARCHIVED"))).orderBy(asc(competitions.startsAt));
  return Promise.all(rows.map(({ competition, event }) => decorateCompetition(competition, event)));
}

async function decorateCompetition(c: typeof competitions.$inferSelect, event: typeof events.$inferSelect): Promise<PublicCompetition> {
  const db = getDb();
  const subs = await db.select({ paid: submissions.paidVoteCount, showcase: submissions.showcaseVoteCount }).from(submissions).where(and(eq(submissions.competitionId, c.id), eq(submissions.state, "VISIBLE")));
  return {
    ...c,
    eventSlug: event.slug, eventTitle: event.title,
    startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString(),
    status: c.isShowcase ? "showcase" : deriveStatus(c),
    submissionCount: subs.length,
    voteCount: subs.reduce((sum, s) => sum + (c.isShowcase ? s.showcase : s.paid), 0),
  };
}

export async function getCompetition(slug: string): Promise<CompetitionDetail | null> {
  if (!hasDatabase()) return getShowcaseCompetition(slug);
  const db = getDb();
  const [row] = await db.select({ competition: competitions, event: events }).from(competitions).innerJoin(events, eq(competitions.eventId, events.id)).where(and(eq(competitions.slug, slug), eq(events.publicationState, "PUBLISHED"), ne(competitions.lifecycle, "ARCHIVED"))).limit(1);
  if (!row) return null;
  const c = await decorateCompetition(row.competition, row.event);
  const subRows = await db.select().from(submissions).where(and(eq(submissions.competitionId, c.id), eq(submissions.state, "VISIBLE"))).orderBy(desc(submissions.createdAt));
  const publicSubs: PublicSubmission[] = subRows.map((s) => ({ id: s.id, competitionId: s.competitionId, name: s.participantName, description: s.description, imageUrl: s.imageUrl, tile: s.tile, glyph: s.glyph, voteCount: c.isShowcase ? s.showcaseVoteCount : s.paidVoteCount, createdAt: s.createdAt.toISOString() }));
  const sorted = rankSubmissions(subRows.map((s) => ({ ...s, voteCount: c.isShowcase ? s.showcaseVoteCount : s.paidVoteCount })));
  const max = Math.max(1, ...sorted.map((s) => s.voteCount));
  const leaderboard = sorted.map((s, index) => ({ id: s.id, competitionId: s.competitionId, name: s.participantName, description: s.description, imageUrl: s.imageUrl, tile: s.tile, glyph: s.glyph, voteCount: s.voteCount, createdAt: s.createdAt.toISOString(), rank: index + 1, percentage: Math.round((s.voteCount / max) * 100) }));
  const winnerRows = await db.select({ winner: competitionWinners, submission: submissions }).from(competitionWinners).innerJoin(submissions, eq(competitionWinners.submissionId, submissions.id)).where(eq(competitionWinners.competitionId, c.id)).orderBy(asc(competitionWinners.rank));
  return {
    ...c, submissions: publicSubs, leaderboard,
    winners: winnerRows.map(({ winner, submission }) => ({ id: submission.id, competitionId: submission.competitionId, name: submission.participantName, description: submission.description, imageUrl: submission.imageUrl, tile: submission.tile, glyph: submission.glyph, voteCount: winner.voteCountSnapshot, createdAt: submission.createdAt.toISOString(), rank: winner.rank, voteCountSnapshot: winner.voteCountSnapshot })),
  };
}

export async function getDashboardData() {
  await requireAdmin();
  if (!hasDatabase()) {
    return { events: showcaseEvents, competitions: showcaseCompetitions, submissions: showcaseSubmissions, payments: [], realRevenuePaise: 0 };
  }
  const db = getDb();
  const [eventRows, compRows, subRows, paymentRows, revenueRows] = await Promise.all([
    db.select().from(events).orderBy(desc(events.createdAt)), db.select().from(competitions).orderBy(desc(competitions.createdAt)), db.select().from(submissions).orderBy(desc(submissions.createdAt)), db.select().from(voteOrders).orderBy(desc(voteOrders.createdAt)).limit(100),
    db.select({ total: sql<number>`coalesce(sum(${voteOrders.amountPaise}), 0)` }).from(voteOrders).where(eq(voteOrders.state, "COMPLETED")),
  ]);
  return { events: eventRows, competitions: compRows, submissions: subRows, payments: paymentRows, realRevenuePaise: Number(revenueRows[0]?.total ?? 0) };
}
