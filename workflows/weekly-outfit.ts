import { FatalError, sleep } from "workflow";

import type { WeeklyWorkflowInput } from "@/lib/workflows/types";
import {
  finalizeWeeklyBatchStep,
  markWeeklyBatchFailedStep,
  persistWeeklyPlanStep,
  pollBatchOnceStep,
  submitWeeklyBatchStep,
} from "@/lib/workflows/weekly-steps";

const POLL_INTERVAL = "5m";
const MAX_POLL_ATTEMPTS = 48;

export async function weeklyOutfitWorkflow(input: WeeklyWorkflowInput) {
  "use workflow";

  const { planId, skipped } = await persistWeeklyPlanStep(input);
  if (skipped) {
    return { planId, status: "skipped" as const };
  }

  const { operationName } = await submitWeeklyBatchStep(input, planId);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const poll = await pollBatchOnceStep(operationName);
    if (!poll.done) {
      await sleep(POLL_INTERVAL);
      continue;
    }

    if (!poll.success || poll.imageUrls.length !== 7) {
      const msg =
        poll.errorText ??
        (poll.imageUrls.length !== 7
          ? `Expected 7 batch response slots, got ${poll.imageUrls.length}`
          : "No decodable images in batch response");
      await markWeeklyBatchFailedStep(planId, operationName, msg);
      throw new FatalError(msg);
    }

    await finalizeWeeklyBatchStep(planId, operationName, poll.imageUrls);
    return { planId, status: "completed" as const };
  }

  const timeoutMsg = `Polling exceeded ${MAX_POLL_ATTEMPTS} attempts (${POLL_INTERVAL} apart).`;
  await markWeeklyBatchFailedStep(planId, operationName, timeoutMsg);
  throw new FatalError(timeoutMsg);
}
