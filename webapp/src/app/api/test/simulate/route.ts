import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailThreads, emailMessages, contacts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  generateCustomerReply,
  TEST_PERSONAS,
  type CustomerPersona,
} from "@/lib/agents/customer-simulator";
import { classifyContact } from "@/lib/agents/contact-classifier";
import { researchContact } from "@/lib/intelligence/web-researcher";
import { getAuthedGmailClient } from "@/lib/google";
import { v4 as uuid } from "uuid";

export const maxDuration = 60;

/**
 * Creates a test simulation thread.
 * Instead of SES, we generate the customer's email via AI and insert
 * it directly into our DB + send via Gmail API (as an import) so it
 * appears as a real inbound thread.
 */
export async function POST(request: NextRequest) {
  const session = await requireUser();
  const body = await request.json();
  const { personaKey } = body as { personaKey: string };

  const persona = TEST_PERSONAS[personaKey];
  if (!persona) {
    return NextResponse.json(
      { error: "Unknown persona", available: Object.keys(TEST_PERSONAS) },
      { status: 400 }
    );
  }

  const initialEmail = await generateCustomerReply({
    persona,
    conversationHistory: [],
    turnNumber: 1,
    maxTurns: 7,
    businessName: "college consulting",
  });

  const subject = generateSubject(persona);

  // Send via Gmail API import so it appears as a real inbound email
  const gmail = await getAuthedGmailClient(session.userId);

  const rawMessage = [
    `From: ${persona.name} <${persona.email}>`,
    `To: ${session.email}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <sim-${uuid()}@easyprincetoncourses.com>`,
    "",
    initialEmail,
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Use Gmail insert to place the message in the inbox
  const { data: inserted } = await gmail.users.messages.insert({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      labelIds: ["INBOX", "UNREAD"],
    },
  });

  const gmailThreadId = inserted.threadId ?? inserted.id ?? "";
  const gmailMessageId = inserted.id ?? "";

  // Create thread in our DB
  const [newThread] = await db
    .insert(emailThreads)
    .values({
      userId: session.userId,
      gmailThreadId,
      subject,
      snippet: initialEmail.substring(0, 200),
      lastMessageAt: new Date(),
      lastMessageDirection: "inbound",
      messageCount: 1,
      isTestSimulation: true,
      currentState: "new",
    })
    .returning();

  // Create message in our DB
  await db.insert(emailMessages).values({
    threadId: newThread.id,
    gmailMessageId,
    direction: "inbound",
    senderEmail: persona.email,
    senderName: persona.name,
    bodySummary: initialEmail.substring(0, 200),
    bodyFull: initialEmail,
    sentAt: new Date(),
  });

  // Create or update contact
  let [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.userId, session.userId), eq(contacts.email, persona.email))
    )
    .limit(1);

  if (!contact) {
    const classification = await classifyContact({
      email: persona.email,
      name: persona.name,
      threadSubjects: [subject],
      threadSnippets: [initialEmail.substring(0, 200)],
      interactionCount: 1,
      directions: ["inbound"],
      businessType: "college consulting",
    });

    [contact] = await db
      .insert(contacts)
      .values({
        userId: session.userId,
        email: persona.email,
        name: persona.name,
        relationshipType: classification.relationshipType,
        relationshipStage: classification.relationshipStage,
        fitScore: classification.fitScore,
        notes: classification.notes,
        totalInteractions: 1,
        lastContactAt: new Date(),
      })
      .returning();
  }

  // Link thread to contact
  await db
    .update(emailThreads)
    .set({ contactId: contact.id })
    .where(eq(emailThreads.id, newThread.id));

  // Web research in background
  researchContact({
    userId: session.userId,
    contactId: contact.id,
    name: persona.name,
    email: persona.email,
  }).catch((err) => console.error("Research failed (non-blocking):", err));

  return NextResponse.json({
    success: true,
    persona: persona.name,
    email: persona.email,
    subject,
    threadId: newThread.id,
    message:
      `Created thread from ${persona.name}. ` +
      `Open it and click "Automate" to start the conversation loop.`,
  });
}

function generateSubject(persona: CustomerPersona): string {
  const subjects = [
    `Interested in college consulting for ${persona.childName}`,
    `Found you in the parent group — need help with ${persona.childName}'s applications`,
    `College admissions help for ${persona.childName}?`,
    `Question about your consulting services`,
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

export async function GET() {
  return NextResponse.json({
    personas: Object.entries(TEST_PERSONAS).map(([key, p]) => ({
      key,
      name: p.name,
      email: p.email,
      backstory: p.backstory,
    })),
  });
}
