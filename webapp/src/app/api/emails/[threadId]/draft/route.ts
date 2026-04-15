import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  emailThreads,
  emailMessages,
  agentActions,
  userProfiles,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { generateDraft } from "@/lib/agents/draft-agent";
import { assessRisk } from "@/lib/agents/risk-engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await requireUser();
  const { threadId } = await params;

  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.id, threadId),
        eq(emailThreads.userId, session.userId)
      )
    )
    .limit(1);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, session.userId))
    .limit(1);

  const messages = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(asc(emailMessages.sentAt));

  // Generate draft with Sonnet 4.6
  const draft = await generateDraft({
    threadSubject: thread.subject ?? "(no subject)",
    threadSnippet: thread.snippet ?? "",
    messageHistory: messages.map((m) => ({
      direction: m.direction,
      senderName: m.senderName,
      bodySummary: m.bodySummary,
      sentAt: m.sentAt?.toISOString() ?? null,
    })),
    classification: thread.classification as Record<string, unknown> | null,
    businessType: user?.businessType ?? undefined,
    founderName: user?.name ?? undefined,
  });

  // Run risk assessment with Sonnet 4.5
  const { assessment, decision } = await assessRisk({
    actionType: "send_email",
    threadSubject: thread.subject ?? "",
    draftContent: draft,
    classification: thread.classification as Record<string, unknown> | null,
    businessType: user?.businessType ?? undefined,
  });

  // Log agent action
  const [action] = await db
    .insert(agentActions)
    .values({
      userId: session.userId,
      threadId,
      actionType: "draft",
      agentName: "DraftAgent",
      input: {
        threadSubject: thread.subject,
        messageCount: messages.length,
      },
      output: { draft, riskDecision: decision.action },
      decisionReasoning: decision.reason,
      riskAssessment: assessment as unknown as Record<string, unknown>,
      status:
        decision.action === "auto_execute"
          ? "completed"
          : "pending_approval",
      modelUsed: "sonnet-4.6 + sonnet-4.5",
    })
    .returning();

  // Update thread state
  await db
    .update(emailThreads)
    .set({
      currentState:
        decision.action === "escalate" ? "escalated" : "draft_ready",
      updatedAt: new Date(),
    })
    .where(eq(emailThreads.id, threadId));

  return NextResponse.json({
    draft,
    riskAssessment: assessment,
    decision,
    actionId: action.id,
  });
}
