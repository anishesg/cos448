import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailThreads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * One-tap actions on a thread: ignore, mark not business, etc.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser();
  const { threadId } = await params;
  const { action } = await request.json();

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

  switch (action) {
    case "ignore":
      await db
        .update(emailThreads)
        .set({ currentState: "hidden", updatedAt: new Date() })
        .where(eq(emailThreads.id, threadId));
      break;

    case "mark_not_business":
      await db
        .update(emailThreads)
        .set({
          businessCategory: "noise",
          currentState: "hidden",
          updatedAt: new Date(),
        })
        .where(eq(emailThreads.id, threadId));
      break;

    case "mark_lead":
      await db
        .update(emailThreads)
        .set({
          businessCategory: "lead",
          businessLeverage: "revenue",
          currentState: "classified",
          updatedAt: new Date(),
        })
        .where(eq(emailThreads.id, threadId));
      break;

    case "archive":
      await db
        .update(emailThreads)
        .set({ currentState: "archived", updatedAt: new Date() })
        .where(eq(emailThreads.id, threadId));
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
