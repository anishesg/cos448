import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";
import { db } from "@/lib/db";
import { agentActions, learnedPreferences } from "@/lib/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const observationSchema = {
  type: "object" as const,
  properties: {
    observations: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          observation: { type: "string" as const },
          confidence: { type: "number" as const, minimum: 0, maximum: 1 },
          appliesTo: {
            type: "string" as const,
            enum: ["triage", "timing", "tone", "autonomy", "alerts"],
          },
          evidence: { type: "string" as const },
        },
        required: ["observation", "confidence", "appliesTo", "evidence"],
      },
    },
  },
  required: ["observations"],
};

export async function analyzeFounderBehavior(userId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

  const actions = await db
    .select()
    .from(agentActions)
    .where(
      and(eq(agentActions.userId, userId), gte(agentActions.createdAt, since))
    )
    .orderBy(desc(agentActions.createdAt))
    .limit(50);

  if (actions.length < 5) return []; // Not enough data

  const approved = actions.filter((a) => a.status === "completed" || a.status === "approved");
  const rejected = actions.filter((a) => a.status === "rejected");
  const pending = actions.filter((a) => a.status === "pending_approval");

  const actionsSummary = actions
    .map(
      (a) =>
        `[${a.agentName}] ${a.actionType} → ${a.status} | reasoning: ${a.decisionReasoning ?? "none"}`
    )
    .join("\n");

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.SONNET_4_5,
      system: [
        {
          text: `You are a learning agent that observes a founder's behavior patterns to improve AI assistance. Analyze the founder's approval/rejection patterns and identify actionable preferences.

Look for patterns like:
- What types of actions they always approve vs reject
- Time-of-day preferences
- Tone or style preferences (from edited drafts)
- Categories where they want more/less autonomy
- Follow-up timing preferences

Only report observations with confidence > 0.6. Be specific and actionable.`,
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Founder behavior in last 7 days:
Total actions: ${actions.length}
Approved/completed: ${approved.length}
Rejected: ${rejected.length}
Pending: ${pending.length}

Action log:
${actionsSummary}

Analyze and identify behavioral patterns.`,
            },
          ],
        },
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "report_observations",
              description: "Report learned behavioral patterns",
              inputSchema: { json: observationSchema },
            },
          },
        ],
        toolChoice: { tool: { name: "report_observations" } },
      },
      inferenceConfig: { maxTokens: 2048 },
    })
  );

  const toolBlock = response.output?.message?.content?.find(
    (b) => "toolUse" in b
  );

  if (!toolBlock || !("toolUse" in toolBlock) || !toolBlock.toolUse?.input) {
    return [];
  }

  const result = toolBlock.toolUse.input as {
    observations: Array<{
      observation: string;
      confidence: number;
      appliesTo: string;
      evidence: string;
    }>;
  };

  // Store observations
  const stored = [];
  for (const obs of result.observations) {
    const [pref] = await db
      .insert(learnedPreferences)
      .values({
        userId,
        observation: obs.observation,
        evidence: { source: obs.evidence } as Record<string, unknown>,
        confidence: String(obs.confidence),
        appliesTo: obs.appliesTo,
        status: "suggested",
      })
      .returning();
    stored.push(pref);
  }

  return stored;
}
