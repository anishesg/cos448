import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, emailThreads, contactResearch } from "@/lib/db/schema";
import { eq, and, desc, or } from "drizzle-orm";

export async function GET() {
  const user = await requireUser();

  const allContacts = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.userId, user.userId),
        or(
          eq(contacts.relationshipType, "lead"),
          eq(contacts.relationshipType, "active_client"),
          eq(contacts.relationshipType, "past_client")
        )
      )
    )
    .orderBy(desc(contacts.lastContactAt));

  // Enrich with thread data and research
  const leads = await Promise.all(
    allContacts.map(async (contact) => {
      const threads = await db
        .select({
          id: emailThreads.id,
          subject: emailThreads.subject,
          currentState: emailThreads.currentState,
          businessCategory: emailThreads.businessCategory,
          classification: emailThreads.classification,
          lastMessageAt: emailThreads.lastMessageAt,
        })
        .from(emailThreads)
        .where(eq(emailThreads.contactId, contact.id))
        .orderBy(desc(emailThreads.lastMessageAt))
        .limit(3);

      const research = await db
        .select({ summary: contactResearch.summary })
        .from(contactResearch)
        .where(eq(contactResearch.contactId, contact.id))
        .orderBy(desc(contactResearch.createdAt))
        .limit(1);

      // Determine pipeline stage from thread states and relationship stage
      let stage = "new";
      const hasMeeting = threads.some(
        (t) =>
          t.currentState === "meeting_scheduled" ||
          t.currentState === "meeting_requested"
      );
      const hasAutomated = threads.some(
        (t) => t.currentState === "automated"
      );
      const hasSent = threads.some(
        (t) =>
          t.currentState === "sent" ||
          t.currentState === "escalated"
      );
      const hasDraft = threads.some((t) => t.currentState === "draft_ready");
      const hasClassified = threads.some((t) => t.currentState === "classified");

      if (hasMeeting || contact.relationshipStage === "meeting_scheduled")
        stage = "meeting_scheduled";
      else if (hasAutomated) stage = "contacted";
      else if (hasSent) stage = "contacted";
      else if (hasDraft) stage = "draft_ready";
      else if (hasClassified && (contact.totalInteractions ?? 0) > 1)
        stage = "engaged";
      else if (hasClassified) stage = "new";
      else if (contact.totalInteractions && contact.totalInteractions > 1)
        stage = "engaged";

      return {
        ...contact,
        stage,
        recentThreads: threads,
        researchSummary: research[0]?.summary ?? null,
      };
    })
  );

  // Group by stage
  const stages = {
    new: leads.filter((l) => l.stage === "new"),
    engaged: leads.filter((l) => l.stage === "engaged"),
    draft_ready: leads.filter((l) => l.stage === "draft_ready"),
    contacted: leads.filter((l) => l.stage === "contacted"),
    meeting_scheduled: leads.filter((l) => l.stage === "meeting_scheduled"),
  };

  return NextResponse.json({ leads, stages, total: leads.length });
}
