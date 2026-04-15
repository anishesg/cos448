import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { db } from "@/lib/db";
import { followUpWorkflows, emailThreads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const sfn = new SFNClient({ region: process.env.AWS_REGION ?? "us-east-1" });

/**
 * Step Functions state machine definition for follow-up loops.
 * Deployed via SST — this is the application-level orchestration.
 */

export interface FollowUpConfig {
  userId: string;
  threadId: string;
  contactId?: string;
  workflowType: "lead_pursuit" | "proposal_follow_up" | "onboarding" | "re_engagement";
  objective: string;
  maxAttempts?: number;
  cadenceHours?: number;
}

const DEFAULT_CONSTRAINTS = {
  lead_pursuit: { maxAttempts: 5, cadenceHours: 48, escalationTriggers: ["pricing", "scope_change", "emotional"] },
  proposal_follow_up: { maxAttempts: 3, cadenceHours: 72, escalationTriggers: ["pricing", "competitor_mention"] },
  onboarding: { maxAttempts: 4, cadenceHours: 24, escalationTriggers: ["blocker", "confusion"] },
  re_engagement: { maxAttempts: 2, cadenceHours: 168, escalationTriggers: ["negative_sentiment"] },
};

export async function startFollowUpWorkflow(config: FollowUpConfig) {
  const constraints = DEFAULT_CONSTRAINTS[config.workflowType];
  const cadence = config.cadenceHours ?? constraints.cadenceHours;
  const nextActionAt = new Date(Date.now() + cadence * 60 * 60 * 1000);

  // Create workflow record
  const [workflow] = await db
    .insert(followUpWorkflows)
    .values({
      userId: config.userId,
      threadId: config.threadId,
      contactId: config.contactId ?? null,
      workflowType: config.workflowType,
      currentStage: "initial_reply_sent",
      objective: config.objective,
      constraints: {
        ...constraints,
        maxAttempts: config.maxAttempts ?? constraints.maxAttempts,
      },
      nextActionAt,
      attemptCount: 0,
      status: "active",
    })
    .returning();

  // Start Step Functions execution if ARN is configured
  const stateMachineArn = process.env.FOLLOW_UP_STATE_MACHINE_ARN;
  if (stateMachineArn) {
    try {
      const result = await sfn.send(
        new StartExecutionCommand({
          stateMachineArn,
          name: `followup-${workflow.id}`,
          input: JSON.stringify({
            workflowId: workflow.id,
            userId: config.userId,
            threadId: config.threadId,
            workflowType: config.workflowType,
            objective: config.objective,
            cadenceHours: cadence,
            maxAttempts: config.maxAttempts ?? constraints.maxAttempts,
          }),
        })
      );

      // Store the execution ARN
      await db
        .update(followUpWorkflows)
        .set({ stepFunctionArn: result.executionArn })
        .where(eq(followUpWorkflows.id, workflow.id));
    } catch (error) {
      console.error("Failed to start Step Functions execution:", error);
    }
  }

  // Update thread state
  await db
    .update(emailThreads)
    .set({ currentState: "awaiting_response", updatedAt: new Date() })
    .where(eq(emailThreads.id, config.threadId));

  return workflow;
}

export async function advanceWorkflow(workflowId: string) {
  const [workflow] = await db
    .select()
    .from(followUpWorkflows)
    .where(eq(followUpWorkflows.id, workflowId))
    .limit(1);

  if (!workflow || workflow.status !== "active") return null;

  const constraints = workflow.constraints as {
    maxAttempts: number;
    cadenceHours: number;
  };

  const newAttemptCount = (workflow.attemptCount ?? 0) + 1;

  if (newAttemptCount >= constraints.maxAttempts) {
    await db
      .update(followUpWorkflows)
      .set({
        status: "completed",
        currentStage: "stale",
        updatedAt: new Date(),
      })
      .where(eq(followUpWorkflows.id, workflowId));

    await db
      .update(emailThreads)
      .set({ currentState: "stale", updatedAt: new Date() })
      .where(eq(emailThreads.id, workflow.threadId));

    return { ...workflow, status: "completed", currentStage: "stale" };
  }

  const nextActionAt = new Date(
    Date.now() + constraints.cadenceHours * 60 * 60 * 1000
  );

  await db
    .update(followUpWorkflows)
    .set({
      attemptCount: newAttemptCount,
      currentStage: "nudge_due",
      nextActionAt,
      updatedAt: new Date(),
    })
    .where(eq(followUpWorkflows.id, workflowId));

  return {
    ...workflow,
    attemptCount: newAttemptCount,
    currentStage: "nudge_due",
    nextActionAt,
  };
}
