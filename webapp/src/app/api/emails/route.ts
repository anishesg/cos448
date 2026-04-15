import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailThreads, contacts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50");
    const rawOffset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    const rows = await db
      .select({
        id: emailThreads.id,
        userId: emailThreads.userId,
        gmailThreadId: emailThreads.gmailThreadId,
        contactId: emailThreads.contactId,
        subject: emailThreads.subject,
        snippet: emailThreads.snippet,
        businessCategory: emailThreads.businessCategory,
        urgency: emailThreads.urgency,
        currentState: emailThreads.currentState,
        agentObjective: emailThreads.agentObjective,
        automationStatus: emailThreads.automationStatus,
        automationTurns: emailThreads.automationTurns,
        lastMessageAt: emailThreads.lastMessageAt,
        lastMessageDirection: emailThreads.lastMessageDirection,
        messageCount: emailThreads.messageCount,
        classification: emailThreads.classification,
        createdAt: emailThreads.createdAt,
        updatedAt: emailThreads.updatedAt,
        contactName: contacts.name,
        contactEmail: contacts.email,
      })
      .from(emailThreads)
      .leftJoin(contacts, eq(emailThreads.contactId, contacts.id))
      .where(eq(emailThreads.userId, user.userId))
      .orderBy(desc(emailThreads.lastMessageAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ threads: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch emails:", error);
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
}
