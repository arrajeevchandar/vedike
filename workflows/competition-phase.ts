import { sleep } from "workflow";
import { start } from "workflow/api";
import { finalizeCompetitionWorkflow } from "@/workflows/finalize-competition";

export async function competitionPhaseWorkflow(
  competitionId: string,
  votingStartsAt: string,
  votingEndsAt: string,
) {
  "use workflow";
  await sleep(Math.max(0, new Date(votingStartsAt).getTime() - Date.now()));
  const opened = await advancePhaseStep(competitionId, votingStartsAt, votingEndsAt);
  if (opened.shouldFinalize) return startFinalizationStep(competitionId);
  await sleep(Math.max(0, new Date(votingEndsAt).getTime() - Date.now()));
  const closed = await advancePhaseStep(competitionId, votingStartsAt, votingEndsAt);
  if (closed.shouldFinalize) return startFinalizationStep(competitionId);
  return closed.state;
}

async function advancePhaseStep(competitionId: string, votingStartsAt: string, votingEndsAt: string) {
  "use step";
  const { advanceScheduledCompetitionPhase } = await import("@/lib/competition-phase");
  return advanceScheduledCompetitionPhase(competitionId, votingStartsAt, votingEndsAt);
}

async function startFinalizationStep(competitionId: string) {
  "use step";
  const run = await start(finalizeCompetitionWorkflow, [competitionId]);
  return run.runId;
}
