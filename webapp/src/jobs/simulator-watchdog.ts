/**
 * AWS Lambda cron handler — runs every 5 minutes via EventBridge.
 *
 * Safety net: finds any active simulation threads where the business has already
 * replied (lastMessageDirection="outbound") but the SQS turn message was dropped
 * (e.g. Lambda crashed, SQS delivery failed). Re-enqueues them so the simulation
 * can continue.
 *
 * Cutoff: only picks up threads that haven't been updated for 3+ minutes, to avoid
 * racing with the SQS subscriber that might be mid-processing.
 */
import { db } from "@/lib/db";
import { emailThreads } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { enqueueTurn } from "@/lib/test/sim-scheduler";

export const handler = async (): Promise<{ queued: number }> => {
  const cutoff = new Date(Date.now() - 3 * 60_000); // 3 minutes ago

  const staleThreads = await db
    .select({
      id: emailThreads.id,
      userId: emailThreads.userId,
      automationTurns: emailThreads.automationTurns,
      automationMaxTurns: emailThreads.automationMaxTurns,
    })
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.isTestSimulation, true),
        eq(emailThreads.automationStatus, "active"),
        eq(emailThreads.lastMessageDirection, "outbound"),
        lt(emailThreads.updatedAt, cutoff)
      )
    );

  console.log(`[SimulatorWatchdog] Found ${staleThreads.length} stale thread(s) to requeue`);

  let queued = 0;
  for (const thread of staleThreads) {
    const turns = thread.automationTurns ?? 0;
    const maxTurns = thread.automationMaxTurns ?? 7;
    if (turns >= maxTurns) continue;

    const enqueued = await enqueueTurn(thread.id, thread.userId, 5);
    if (enqueued) {
      console.log(`[SimulatorWatchdog] Requeued thread ${thread.id} (turn ${turns}/${maxTurns})`);
      queued++;
    }
  }

  return { queued };
};
