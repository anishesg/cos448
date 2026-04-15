import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  contacts,
  contactResearch,
  emailThreads,
  emailMessages,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { researchContact } from "@/lib/intelligence/web-researcher";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const research = await db
    .select()
    .from(contactResearch)
    .where(
      and(
        eq(contactResearch.contactId, id),
        eq(contactResearch.userId, user.userId)
      )
    )
    .orderBy(desc(contactResearch.createdAt));

  return NextResponse.json({ research });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, user.userId)))
    .limit(1);

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const threads = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.contactId, id),
        eq(emailThreads.userId, user.userId)
      )
    );

  let emailContext = "";
  if (threads.length > 0) {
    const threadIds = threads.map((t) => t.id);
    const msgs = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.threadId, threadIds[0]))
      .orderBy(emailMessages.sentAt);

    emailContext = msgs
      .slice(-10)
      .map(
        (m) =>
          `[${m.direction}] ${(m.bodyFull ?? m.bodySummary ?? "").slice(0, 500)}`
      )
      .join("\n---\n");
  }

  const result = await researchContact({
    userId: user.userId,
    contactId: id,
    name: contact.name,
    email: contact.email,
    company: contact.company,
    emailContext,
  });

  return NextResponse.json(result);
}
