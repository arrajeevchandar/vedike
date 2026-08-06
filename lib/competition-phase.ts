import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { adminAuditLog, competitions } from "@/db/schema";
import { canAcceptVote, canSubmitApplication, deriveCompetitionPhase } from "@/lib/domain";

type Competition = typeof competitions.$inferSelect;

export function applicationWindowOpen(competition: Competition, now = new Date()) {
  return canSubmitApplication({
    applicationStartsAt: competition.applicationStartsAt,
    applicationEndsAt: competition.applicationEndsAt,
    votingStartsAt: competition.votingStartsAt,
    votingEndsAt: competition.votingEndsAt,
    lifecycle: competition.lifecycle,
    isShowcase: competition.isShowcase,
    now,
  });
}

export function votingWindowOpen(competition: Competition, now = new Date()) {
  return canAcceptVote({
    applicationStartsAt: competition.applicationStartsAt,
    applicationEndsAt: competition.applicationEndsAt,
    votingStartsAt: competition.votingStartsAt,
    votingEndsAt: competition.votingEndsAt,
    lifecycle: competition.lifecycle,
    isShowcase: competition.isShowcase,
    now,
  });
}

export function publicCompetitionPhase(competition: Competition, now = new Date()) {
  return deriveCompetitionPhase({
    applicationStartsAt: competition.applicationStartsAt,
    applicationEndsAt: competition.applicationEndsAt,
    votingStartsAt: competition.votingStartsAt,
    votingEndsAt: competition.votingEndsAt,
    lifecycle: competition.lifecycle,
    isShowcase: competition.isShowcase,
    now,
  });
}

export async function advanceScheduledCompetitionPhase(
  competitionId: string,
  expectedVotingStartsAt: string,
  expectedVotingEndsAt: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${competitionId}, 0))`);
    const [competition] = await tx.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
    if (!competition || competition.isShowcase) return { state: "SKIPPED" as const, shouldFinalize: false };
    if (
      competition.votingStartsAt.toISOString() !== expectedVotingStartsAt ||
      competition.votingEndsAt.toISOString() !== expectedVotingEndsAt
    ) return { state: "STALE" as const, shouldFinalize: false };

    const now = new Date();
    if (competition.lifecycle === "APPLICATIONS_OPEN" && now >= competition.votingStartsAt && now < competition.votingEndsAt) {
      await tx.update(competitions).set({ lifecycle: "VOTING_OPEN", votingOpenedAt: now, updatedAt: now }).where(eq(competitions.id, competition.id));
      await tx.insert(adminAuditLog).values({ action: "AUTOMATIC_VOTING_OPENED", entityType: "competition", entityId: competition.id });
      return { state: "VOTING_OPEN" as const, shouldFinalize: false };
    }
    if (
      (competition.lifecycle === "APPLICATIONS_OPEN" || competition.lifecycle === "VOTING_OPEN") &&
      now >= competition.votingEndsAt
    ) {
      const [claimed] = await tx.update(competitions).set({ lifecycle: "CLOSING", completionStartedAt: now, updatedAt: now }).where(and(eq(competitions.id, competition.id), eq(competitions.lifecycle, competition.lifecycle))).returning({ id: competitions.id });
      if (claimed) await tx.insert(adminAuditLog).values({ action: "AUTOMATIC_VOTING_CLOSED", entityType: "competition", entityId: competition.id });
      return { state: "CLOSING" as const, shouldFinalize: Boolean(claimed) };
    }
    return { state: competition.lifecycle, shouldFinalize: false };
  });
}
