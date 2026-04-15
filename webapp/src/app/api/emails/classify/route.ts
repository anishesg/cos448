import { NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailThreads, emailMessages, userProfiles } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { classifyEmail } from "@/lib/agents/triage-agent";

export async function POST() {
  try {
    const session = await requireApiUser();

  const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, session.userId))
    .limit(1);

  const unclassified = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.userId, session.userId),
        isNull(emailThreads.classification)
      )
    )
    .limit(20);

  if (unclassified.length === 0) {
    return NextResponse.json({ classified: 0 });
  }

  let classified = 0;
  let failed = 0;

  for (const thread of unclassified) {
    try {
      const [latestMsg] = await db
        .select({ senderEmail: emailMessages.senderEmail, senderName: emailMessages.senderName })
        .from(emailMessages)
        .where(eq(emailMessages.threadId, thread.id))
        .orderBy(desc(emailMessages.sentAt))
        .limit(1);

      const result = await classifyEmail({
        subject: thread.subject ?? "(no subject)",
        snippet: thread.snippet ?? "",
        senderEmail: latestMsg?.senderEmail ?? "",
        senderName: latestMsg?.senderName ?? null,
        messageCount: thread.messageCount ?? 1,
        direction: thread.lastMessageDirection ?? "inbound",
        businessType: user?.businessType ?? undefined,
      });

      await db
        .update(emailThreads)
        .set({
          businessCategory: result.businessCategory,
          urgency: result.urgency,
          businessLeverage: result.businessLeverage,
          currentState:
            result.recommendedAction === "hide" ? "hidden" : "classified",
          agentObjective: result.agentObjective,
          classification: result as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(emailThreads.id, thread.id));

      classified++;
    } catch (error) {
      console.error(`Failed to classify thread ${thread.id}:`, error);
      failed++;
    }
  }

  return NextResponse.json({ classified, failed, total: unclassified.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Classification error:", error);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
