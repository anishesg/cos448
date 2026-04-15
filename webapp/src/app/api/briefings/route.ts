import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  briefings,
  emailThreads,
  agentActions,
  followUpWorkflows,
  userProfiles,
} from "@/lib/db/schema";
import { eq, and, desc, gte, count, sql } from "drizzle-orm";
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export async function GET() {
  const user = await requireUser();

  const latest = await db
    .select()
    .from(briefings)
    .where(eq(briefings.userId, user.userId))
    .orderBy(desc(briefings.generatedAt))
    .limit(5);

  return NextResponse.json({ briefings: latest });
}

export async function POST(request: NextRequest) {
  const session = await requireUser();
  const { type } = await request.json();

  if (!type || !["morning", "evening"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'morning' or 'evening'" },
      { status: 400 }
    );
  }

  const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, session.userId))
    .limit(1);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Gather context
  const recentActions = await db
    .select()
    .from(agentActions)
    .where(
      and(
        eq(agentActions.userId, session.userId),
        gte(agentActions.createdAt, since)
      )
    )
    .orderBy(desc(agentActions.createdAt))
    .limit(20);

  const activeWorkflows = await db
    .select()
    .from(followUpWorkflows)
    .where(
      and(
        eq(followUpWorkflows.userId, session.userId),
        eq(followUpWorkflows.status, "active")
      )
    );

  const needsAttention = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.userId, session.userId),
        sql`${emailThreads.currentState} IN ('escalated', 'draft_ready')`
      )
    );

  const actionsHandled = recentActions.filter(
    (a) => a.status === "completed"
  ).length;
  const pendingApprovals = recentActions.filter(
    (a) => a.status === "pending_approval"
  ).length;

  const contextSummary = `
Actions in last 24h: ${recentActions.length} total, ${actionsHandled} completed, ${pendingApprovals} pending approval
Active follow-up workflows: ${activeWorkflows.length}
Threads needing attention: ${needsAttention.length}
Threads escalated: ${needsAttention.filter((t) => t.currentState === "escalated").length}
Drafts ready for review: ${needsAttention.filter((t) => t.currentState === "draft_ready").length}

Recent actions: ${recentActions.slice(0, 10).map((a) => `[${a.agentName}] ${a.actionType}: ${a.decisionReasoning ?? "no reasoning"}`).join("\n")}

Threads needing attention:
${needsAttention.map((t) => `- "${t.subject}" (${t.businessCategory}, ${t.urgency} urgency, state: ${t.currentState})`).join("\n")}
`;

  const systemPrompt = `You are a Chief of Staff AI for a solo ${user?.businessType ?? "service"} business${user?.name ? ` owner named ${user.name}` : ""}.

Generate a ${type} briefing in this style — calm, concise, high agency. Think executive memo, not dashboard.

${type === "morning" ? `Morning briefing format:
1. Start with a warm one-line greeting
2. Top-line summary (what happened since last evening, 1-2 sentences)
3. "Your Priorities Today" — 2-4 numbered items with specific actions
4. "Decisions Needed" — anything requiring founder judgment
5. "At Risk" — anything that could slip if ignored today` : `Evening briefing format:
1. Start with a brief status line
2. "Handled For You" — what the system did today
3. "What Changed" — status updates on active threads
4. "Still Waiting" — things pending external response
5. "Tomorrow's Risks" — what needs attention first thing`}

Be specific. Use thread names and contact names. Keep each section to 2-4 lines.`;

  const response = await bedrock.send(
    new ConverseStreamCommand({
      modelId: MODELS.SONNET_4_6,
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: "user",
          content: [{ text: `Generate the ${type} briefing based on this context:\n${contextSummary}` }],
        },
      ],
      inferenceConfig: { maxTokens: 2048 },
    })
  );

  let content = "";
  if (response.stream) {
    for await (const event of response.stream) {
      if (
        event.contentBlockDelta?.delta &&
        "text" in event.contentBlockDelta.delta
      ) {
        content += event.contentBlockDelta.delta.text ?? "";
      }
    }
  }

  const [briefing] = await db
    .insert(briefings)
    .values({
      userId: session.userId,
      type,
      content: { markdown: content, stats: { actionsHandled, pendingApprovals, activeWorkflows: activeWorkflows.length, needsAttention: needsAttention.length } },
    })
    .returning();

  return NextResponse.json({ briefing });
}
