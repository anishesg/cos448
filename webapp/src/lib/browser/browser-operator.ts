import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { db } from "@/lib/db";
import { browserTasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const sqs = new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export type BrowserTier = 1 | 2 | 3;

interface BrowserTaskInput {
  userId: string;
  threadId?: string;
  objective: string;
  targetUrl: string;
  tier?: BrowserTier;
}

/**
 * Tier resolution: determines which automation tier to use.
 *
 * Tier 1: Deterministic - known login flow, known selectors, high reliability
 * Tier 2: Guided dynamic - AI navigates with Stagehand, known page class
 * Tier 3: Open web agent - full AI-driven navigation, limited step budget
 */

const TIER_1_PATTERNS: Array<{ match: RegExp; script: string }> = [
  { match: /messenger\.com|facebook\.com\/messages/, script: "fb-messenger" },
  { match: /calendar\.google\.com/, script: "google-calendar" },
  { match: /linkedin\.com\/messaging/, script: "linkedin-messages" },
];

export function resolveTier(url: string): {
  tier: BrowserTier;
  script: string | null;
} {
  for (const pattern of TIER_1_PATTERNS) {
    if (pattern.match.test(url)) {
      return { tier: 1, script: pattern.script };
    }
  }

  // Known semi-structured patterns → Tier 2
  const tier2Patterns = [
    /portal\./,
    /dashboard\./,
    /app\./,
    /admin\./,
    /forms\./,
  ];
  if (tier2Patterns.some((p) => p.test(url))) {
    return { tier: 2, script: null };
  }

  // Unknown → Tier 3
  return { tier: 3, script: null };
}

export async function createBrowserTask(input: BrowserTaskInput) {
  const resolution = resolveTier(input.targetUrl);
  const tier = input.tier ?? resolution.tier;

  const [task] = await db
    .insert(browserTasks)
    .values({
      userId: input.userId,
      threadId: input.threadId ?? null,
      objective: input.objective,
      tier,
      targetUrl: input.targetUrl,
      status: tier <= 1 ? "approved" : "pending",
    })
    .returning();

  // Tier 1 tasks are auto-approved and queued immediately
  if (tier === 1) {
    await queueBrowserTask(task.id, input.targetUrl, input.objective, tier, resolution.script);
  }

  return task;
}

async function queueBrowserTask(
  taskId: string,
  url: string,
  objective: string,
  tier: number,
  script: string | null
) {
  const queueUrl = process.env.BROWSER_QUEUE_URL;
  if (!queueUrl) {
    console.warn("BROWSER_QUEUE_URL not set — skipping SQS enqueue");
    return;
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        taskId,
        url,
        objective,
        tier,
        script,
      }),
    })
  );

  await db
    .update(browserTasks)
    .set({ status: "executing" })
    .where(eq(browserTasks.id, taskId));
}

export async function approveBrowserTask(taskId: string) {
  const [task] = await db
    .select()
    .from(browserTasks)
    .where(eq(browserTasks.id, taskId))
    .limit(1);

  if (!task || task.status !== "pending") return null;

  await queueBrowserTask(
    taskId,
    task.targetUrl ?? "",
    task.objective,
    task.tier,
    null
  );

  return task;
}

export async function completeBrowserTask(
  taskId: string,
  result: Record<string, unknown>,
  screenshotPath?: string,
  tracePath?: string
) {
  await db
    .update(browserTasks)
    .set({
      status: "succeeded",
      result,
      screenshotS3Path: screenshotPath ?? null,
      traceS3Path: tracePath ?? null,
    })
    .where(eq(browserTasks.id, taskId));
}

export async function failBrowserTask(taskId: string, error: string) {
  await db
    .update(browserTasks)
    .set({
      status: "failed",
      result: { error } as Record<string, unknown>,
    })
    .where(eq(browserTasks.id, taskId));
}
