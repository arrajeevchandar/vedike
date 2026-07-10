import { sleep } from "workflow";

export async function finalizeCompetitionWorkflow(competitionId: string) {
  "use workflow";
  for (let attempt=0;attempt<20;attempt++) {
    const pending = await reconcilePendingStep(competitionId);
    if (pending === 0) return snapshotWinnersStep(competitionId);
    await sleep(attempt < 5 ? "10s" : "30s");
  }
  return markReviewStep(competitionId);
}

async function reconcilePendingStep(competitionId:string){
  "use step";
  console.log(`[finalizeCompetition] START competitionId=${competitionId}`);
  const {getDb}=await import("@/db");const {voteOrders}=await import("@/db/schema");const {and,eq,inArray}=await import("drizzle-orm");
  const rows=await getDb().select({id:voteOrders.id}).from(voteOrders).where(and(eq(voteOrders.competitionId,competitionId),inArray(voteOrders.state,["CREATED","PENDING","REFUND_PENDING"])));
  const {reconcileOrder}=await import("@/lib/payments");for(const row of rows)await reconcileOrder(row.id).catch(error=>console.error(`[finalizeCompetition] reconcile ${row.id}`,error));
  return rows.length;
}

async function snapshotWinnersStep(competitionId:string){
  "use step";
  const {getDb}=await import("@/db");const {competitions,competitionWinners,submissions}=await import("@/db/schema");const {and,asc,desc,eq,isNotNull,sql}=await import("drizzle-orm");
  await getDb().transaction(async tx=>{const rows=await tx.select().from(submissions).where(and(eq(submissions.competitionId,competitionId),eq(submissions.state,"VISIBLE"))).orderBy(desc(submissions.paidVoteCount),asc(sql`coalesce(${submissions.lastVoteReachedAt}, ${submissions.createdAt})`),asc(submissions.createdAt)).limit(3);await tx.delete(competitionWinners).where(eq(competitionWinners.competitionId,competitionId));if(rows.length)await tx.insert(competitionWinners).values(rows.map((row,index)=>({competitionId,submissionId:row.id,rank:index+1,voteCountSnapshot:row.paidVoteCount,tieBreakAt:row.lastVoteReachedAt??row.createdAt})));await tx.update(competitions).set({lifecycle:"COMPLETED",completedAt:new Date(),updatedAt:new Date()}).where(eq(competitions.id,competitionId))});
  console.log(`[finalizeCompetition] DONE competitionId=${competitionId}`);return "COMPLETED";
}

async function markReviewStep(competitionId:string){"use step";const {getDb}=await import("@/db");const {adminAuditLog}=await import("@/db/schema");await getDb().insert(adminAuditLog).values({action:"FINALIZATION_REVIEW_REQUIRED",entityType:"competition",entityId:competitionId,metadata:{reason:"Pending payments did not settle within the workflow window."}});return "REVIEW_REQUIRED"}
