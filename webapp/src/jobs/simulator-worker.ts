/**
 * AWS Lambda handler — triggered by SimulatorQueue (SQS).
 *
 * Each SQS message payload: { threadId: string, userId: string }
 *
 * The worker runs one full simulation turn (customer AI reply → business AI reply),
 * then re-enqueues to SQS for the next turn with a ~20-35 second delay.
 * The cron watchdog (simulator-watchdog.ts) catches any jobs that were dropped.
 */
import { runSimulateRespondTurn } from "@/lib/test/simulate-respond-turn";
import { enqueueTurn } from "@/lib/test/sim-scheduler";

interface SQSRecord {
  body: string;
}

interface SQSEvent {
  Records: SQSRecord[];
}

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    let threadId: string;
    let userId: string;

    try {
      ({ threadId, userId } = JSON.parse(record.body));
    } catch {
      console.error("[SimulatorWorker] Bad SQS message body:", record.body);
      continue;
    }

    console.log(`[SimulatorWorker] Processing thread ${threadId} for user ${userId}`);

    try {
      // scheduleNext=false: we handle scheduling ourselves after the turn completes
      const result = await runSimulateRespondTurn(threadId, userId, {
        scheduleNext: false,
      });

      if (!result.ok) {
        console.error(`[SimulatorWorker] Turn failed for thread ${threadId}:`, result.body);
        continue;
      }

      const body = result.body as { status?: string; turn?: number; maxTurns?: number };

      if (body.status !== "completed" && body.status !== "automation_complete") {
        // Schedule the next customer reply with a realistic delay (20–35 s)
        const delaySeconds = 20 + Math.floor(Math.random() * 15);
        const enqueued = await enqueueTurn(threadId, userId, delaySeconds);
        if (enqueued) {
          console.log(
            `[SimulatorWorker] Turn ${body.turn}/${body.maxTurns} done — next turn in ~${delaySeconds}s`
          );
        }
      } else {
        console.log(`[SimulatorWorker] Simulation complete for thread ${threadId}`);
      }
    } catch (err) {
      console.error(`[SimulatorWorker] Unhandled error for thread ${threadId}:`, err);
    }
  }
};
