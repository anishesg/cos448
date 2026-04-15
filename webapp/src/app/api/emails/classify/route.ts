import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailThreads, userProfiles } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { classifyEmail } from "@/lib/agents/triage-agent";

/**
 * Classify all unclassified email threads for the current user.
 * Calls Haiku 4.5 via Bedrock for each thread.
 */
export async function POST() {
  const session = await requireUser();

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

  for (const thread of unclassified) {
    try {
      const result = await classifyEmail({
        subject: thread.subject ?? "(no subject)",
        snippet: thread.snippet ?? "",
        senderEmail: "",
        senderName: null,
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
    }
  }

  return NextResponse.json({ classified });
}
