import { db } from "@/lib/db";
import {
  contacts,
  emailThreads,
  emailMessages,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { classifyContact } from "@/lib/agents/contact-classifier";

interface ExtractedContact {
  email: string;
  name: string | null;
  threadIds: string[];
  subjects: string[];
  snippets: string[];
  directions: string[];
  interactionCount: number;
  lastContactAt: Date;
}

export async function extractContacts(userId: string, businessType?: string): Promise<number> {
  // Get all messages for this user's threads
  const threads = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.userId, userId));

  if (!threads.length) return 0;

  const threadMap = new Map(threads.map((t) => [t.id, t]));
  const contactMap = new Map<string, ExtractedContact>();

  for (const thread of threads) {
    const messages = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.threadId, thread.id));

    for (const msg of messages) {
      if (!msg.senderEmail || msg.direction === "outbound") continue;

      const email = msg.senderEmail.toLowerCase();
      const existing = contactMap.get(email);

      if (existing) {
        existing.interactionCount++;
        if (!existing.threadIds.includes(thread.id)) {
          existing.threadIds.push(thread.id);
          existing.subjects.push(thread.subject ?? "");
          existing.snippets.push(thread.snippet ?? "");
        }
        existing.directions.push(msg.direction);
        if (msg.sentAt && msg.sentAt > existing.lastContactAt) {
          existing.lastContactAt = msg.sentAt;
        }
        if (msg.senderName && !existing.name) {
          existing.name = msg.senderName;
        }
      } else {
        contactMap.set(email, {
          email,
          name: msg.senderName,
          threadIds: [thread.id],
          subjects: [thread.subject ?? ""],
          snippets: [thread.snippet ?? ""],
          directions: [msg.direction],
          interactionCount: 1,
          lastContactAt: msg.sentAt ?? new Date(),
        });
      }
    }
  }

  let created = 0;

  for (const [email, data] of contactMap) {
    // Upsert contact
    const existing = await db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.userId, userId), eq(contacts.email, email))
      )
      .limit(1);

    let contactId: string;

    if (existing.length > 0) {
      contactId = existing[0].id;
      await db
        .update(contacts)
        .set({
          name: data.name ?? existing[0].name,
          totalInteractions: data.interactionCount,
          lastContactAt: data.lastContactAt,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contactId));
    } else {
      // Classify new contacts with AI
      const classification = await classifyContact({
        email: data.email,
        name: data.name,
        threadSubjects: data.subjects,
        threadSnippets: data.snippets,
        interactionCount: data.interactionCount,
        directions: data.directions,
        businessType,
      });

      const [newContact] = await db
        .insert(contacts)
        .values({
          userId,
          email: data.email,
          name: data.name,
          relationshipType: classification.relationshipType,
          relationshipStage: classification.relationshipStage,
          fitScore: classification.fitScore,
          revenuePotential: classification.revenuePotential === "none" ? "0" : classification.revenuePotential === "low" ? "100" : classification.revenuePotential === "medium" ? "500" : "1000",
          notes: classification.notes,
          totalInteractions: data.interactionCount,
          lastContactAt: data.lastContactAt,
          metadata: classification as unknown as Record<string, unknown>,
        })
        .returning({ id: contacts.id });

      contactId = newContact.id;
      created++;
    }

    // Link threads to this contact
    for (const threadId of data.threadIds) {
      await db
        .update(emailThreads)
        .set({ contactId })
        .where(
          and(
            eq(emailThreads.id, threadId),
            eq(emailThreads.userId, userId)
          )
        );
    }
  }

  return created;
}
