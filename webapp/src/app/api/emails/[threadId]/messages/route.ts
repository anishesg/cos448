import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailMessages, emailThreads, contacts, agentActions } from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser();
  const { threadId } = await params;

  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(
      and(eq(emailThreads.id, threadId), eq(emailThreads.userId, user.userId))
    )
    .limit(1);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(asc(emailMessages.sentAt));

  // Get linked contact if any
  let contact = null;
  if (thread.contactId) {
    const [c] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, thread.contactId))
      .limit(1);
    contact = c ?? null;
  }

  // Get pending draft if any (matches both manual "draft" and auto "auto_draft")
  const pendingDrafts = await db
    .select()
    .from(agentActions)
    .where(
      and(
        eq(agentActions.threadId, threadId),
        eq(agentActions.actionType, "draft")
      )
    )
    .orderBy(desc(agentActions.createdAt))
    .limit(1);

  let pendingDraft = pendingDrafts[0] ?? null;
  if (!pendingDraft) {
    const autoDrafts = await db
      .select()
      .from(agentActions)
      .where(
        and(
          eq(agentActions.threadId, threadId),
          eq(agentActions.actionType, "auto_draft"),
        )
      )
      .orderBy(desc(agentActions.createdAt))
      .limit(1);
    pendingDraft = autoDrafts[0] ?? null;
  }

  const isReviewable =
    pendingDraft?.status === "pending_approval" ||
    pendingDraft?.status === "pending_review";

  const draft = isReviewable
    ? ((pendingDraft?.output as Record<string, unknown>)?.draft as string | undefined) ?? null
    : null;

  return NextResponse.json({ thread, messages, contact, draft });
}
