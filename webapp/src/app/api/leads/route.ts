import { NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, emailThreads, contactResearch } from "@/lib/db/schema";
import { eq, and, desc, or, inArray } from "drizzle-orm";

function determineStage(
  threads: Array<{ currentState: string | null }>,
  contact: { relationshipStage: string | null; totalInteractions: number | null }
): string {
  const hasMeeting = threads.some(
    (t) => t.currentState === "meeting_scheduled" || t.currentState === "meeting_requested"
  );
  const hasAutomated = threads.some((t) => t.currentState === "automated");
  const hasSent = threads.some((t) => t.currentState === "sent" || t.currentState === "escalated");
  const hasDraft = threads.some((t) => t.currentState === "draft_ready");
  const hasClassified = threads.some((t) => t.currentState === "classified");

  if (hasMeeting || contact.relationshipStage === "meeting_scheduled") return "meeting_scheduled";
  if (hasAutomated || hasSent) return "contacted";
  if (hasDraft) return "draft_ready";
  if (hasClassified && (contact.totalInteractions ?? 0) > 1) return "engaged";
  if (hasClassified) return "new";
  if (contact.totalInteractions && contact.totalInteractions > 1) return "engaged";
  return "new";
}

export async function GET() {
  try {
    const user = await requireApiUser();

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

    if (allContacts.length === 0) {
      return NextResponse.json({ leads: [], stages: { new: [], engaged: [], draft_ready: [], contacted: [], meeting_scheduled: [] }, total: 0 });
    }

    const contactIds = allContacts.map((c) => c.id);

    const allThreads = await db
      .select({
        id: emailThreads.id,
        contactId: emailThreads.contactId,
        subject: emailThreads.subject,
        currentState: emailThreads.currentState,
        businessCategory: emailThreads.businessCategory,
        classification: emailThreads.classification,
        lastMessageAt: emailThreads.lastMessageAt,
      })
      .from(emailThreads)
      .where(inArray(emailThreads.contactId, contactIds))
      .orderBy(desc(emailThreads.lastMessageAt));

    const allResearch = await db
      .select({
        contactId: contactResearch.contactId,
        summary: contactResearch.summary,
        createdAt: contactResearch.createdAt,
      })
      .from(contactResearch)
      .where(inArray(contactResearch.contactId, contactIds))
      .orderBy(desc(contactResearch.createdAt));

    const threadsByContact = new Map<string, typeof allThreads>();
    for (const t of allThreads) {
      if (!t.contactId) continue;
      const list = threadsByContact.get(t.contactId) ?? [];
      if (list.length < 3) list.push(t);
      threadsByContact.set(t.contactId, list);
    }

    const researchByContact = new Map<string, string>();
    for (const r of allResearch) {
      if (!researchByContact.has(r.contactId)) {
        researchByContact.set(r.contactId, r.summary ?? "");
      }
    }

    const leads = allContacts.map((contact) => {
      const threads = threadsByContact.get(contact.id) ?? [];
      const stage = determineStage(threads, contact);
      return {
        ...contact,
        stage,
        recentThreads: threads,
        researchSummary: researchByContact.get(contact.id) ?? null,
      };
    });

    const stages = {
      new: leads.filter((l) => l.stage === "new"),
      engaged: leads.filter((l) => l.stage === "engaged"),
      draft_ready: leads.filter((l) => l.stage === "draft_ready"),
      contacted: leads.filter((l) => l.stage === "contacted"),
      meeting_scheduled: leads.filter((l) => l.stage === "meeting_scheduled"),
    };

    return NextResponse.json({ leads, stages, total: leads.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch leads:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
