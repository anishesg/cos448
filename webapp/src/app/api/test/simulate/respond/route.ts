import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  emailThreads,
  emailMessages,
  userProfiles,
  agentActions,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  generateCustomerReply,
  TEST_PERSONAS,
} from "@/lib/agents/customer-simulator";
import { getAuthedGmailClient } from "@/lib/google";
import { generateDraft } from "@/lib/agents/draft-agent";
import { v4 as uuid } from "uuid";

export const maxDuration = 120;

/**
 * Self-contained automation loop turn (no SES required).
 * 1) Generate customer AI reply and insert into Gmail + DB
 * 2) Generate our business reply and send via Gmail
 * 3) Schedule the next turn (if under limit)
 */
export async function POST(request: NextRequest) {
  const { threadId, userId } = await request.json();

  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.id, threadId))
    .limit(1);

  if (!thread || !thread.isTestSimulation) {
    return NextResponse.json({ error: "Not a test thread" }, { status: 400 });
  }

  const turns = thread.automationTurns ?? 0;
  const maxTurns = thread.automationMaxTurns ?? 7;

  if (thread.automationStatus !== "active" || turns >= maxTurns) {
    await db
      .update(emailThreads)
      .set({ automationStatus: "completed", updatedAt: new Date() })
      .where(eq(emailThreads.id, threadId));
    return NextResponse.json({ status: "automation_complete" });
  }

  const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);

  const gmail = await getAuthedGmailClient(userId);

  // --- Step 1: Generate customer AI reply ---

  const messages = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(emailMessages.sentAt);

  const firstInbound = messages.find((m) => m.direction === "inbound");
  const customerEmail = firstInbound?.senderEmail ?? "";
  const personaKey = customerEmail.split("@")[0];
  const persona = TEST_PERSONAS[personaKey];

  if (!persona) {
    return NextResponse.json(
      { error: "Unknown persona: " + personaKey },
      { status: 400 }
    );
  }

  const conversationHistory = messages.map((m) => ({
    role: (m.direction === "inbound" ? "customer" : "business") as
      | "customer"
      | "business",
    content: m.bodyFull ?? m.bodySummary ?? "",
  }));

  const customerReply = await generateCustomerReply({
    persona,
    conversationHistory,
    turnNumber: turns + 1,
    maxTurns,
    businessName: "college consulting",
  });

  // Insert customer message into Gmail via insert API
  const customerRaw = [
    `From: ${persona.name} <${persona.email}>`,
    `To: ${user?.email ?? "anish@textfriday.com"}`,
    `Subject: Re: ${thread.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <sim-${uuid()}@easyprincetoncourses.com>`,
    "",
    customerReply,
  ].join("\r\n");

  const encodedCustomer = Buffer.from(customerRaw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const { data: customerInserted } = await gmail.users.messages.insert({
    userId: "me",
    requestBody: {
      raw: encodedCustomer,
      threadId: thread.gmailThreadId,
      labelIds: ["INBOX", "UNREAD"],
    },
  });

  // Store customer message in DB
  await db.insert(emailMessages).values({
    threadId,
    gmailMessageId: customerInserted.id ?? `sim-${uuid()}`,
    direction: "inbound",
    senderEmail: persona.email,
    senderName: persona.name,
    bodySummary: customerReply.substring(0, 200),
    bodyFull: customerReply,
    sentAt: new Date(),
  });

  await db
    .update(emailThreads)
    .set({
      snippet: customerReply.substring(0, 200),
      lastMessageAt: new Date(),
      lastMessageDirection: "inbound",
      messageCount: messages.length + 1,
      updatedAt: new Date(),
    })
    .where(eq(emailThreads.id, threadId));

  console.log(
    `[Sim Turn ${turns + 1}] Customer (${persona.name}) replied (inserted into Gmail)`
  );

  // Small pause to simulate real-time feel
  await new Promise((r) => setTimeout(r, 3000));

  // --- Step 2: Generate business reply and send via Gmail ---

  const allMessages = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(emailMessages.sentAt);

  const writingStyle = (user?.onboardingAnswers as Record<string, unknown>)
    ?.writingStyle as
    | {
        summary?: string;
        tone?: string;
        signOff?: string;
        traits?: string[];
        avoidances?: string[];
      }
    | undefined;

  const styleContext = writingStyle
    ? `\nMatch the founder's writing style:
${writingStyle.summary}
Tone: ${writingStyle.tone}
Sign off: ${writingStyle.signOff}
NEVER use: ${writingStyle.avoidances?.join(", ")}`
    : "\nWrite in a friendly, human tone. No em dashes. Sound informed.";

  const draft = await generateDraft({
    threadSubject: thread.subject ?? "",
    threadSnippet: customerReply.substring(0, 200),
    messageHistory: allMessages.map((m) => ({
      direction: m.direction,
      senderName: m.senderName,
      bodySummary: m.bodyFull ?? m.bodySummary,
      sentAt: m.sentAt?.toISOString() ?? null,
    })),
    classification: thread.classification as Record<string, string> | null,
    businessType: user?.businessType ?? "college consulting",
    founderName: user?.name ?? undefined,
    businessContext: styleContext,
  });

  // Send real reply via Gmail API
  const rawMessage = [
    `To: ${persona.email}`,
    `Subject: Re: ${thread.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    draft,
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const { data: sent } = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId: thread.gmailThreadId,
    },
  });

  if (sent.id) {
    await db.insert(emailMessages).values({
      threadId,
      gmailMessageId: sent.id,
      direction: "outbound",
      senderEmail: user?.email ?? "anish@textfriday.com",
      senderName: user?.name ?? "Anish",
      bodySummary: draft.substring(0, 200),
      bodyFull: draft,
      sentAt: new Date(),
      isAgentGenerated: true,
    });
  }

  const newTurns = turns + 1;

  await db.insert(agentActions).values({
    userId,
    threadId,
    actionType: "automation_reply",
    agentName: "automate-agent",
    output: {
      draft,
      turn: newTurns,
      customerReply: customerReply.substring(0, 300),
    } as Record<string, unknown>,
    status: "completed",
    modelUsed: "us.anthropic.claude-sonnet-4-6",
  });

  await db
    .update(emailThreads)
    .set({
      automationTurns: newTurns,
      lastMessageAt: new Date(),
      lastMessageDirection: "outbound",
      messageCount: allMessages.length + 1,
      updatedAt: new Date(),
      automationStatus: newTurns >= maxTurns ? "completed" : "active",
    })
    .where(eq(emailThreads.id, threadId));

  console.log(
    `[Sim Turn ${newTurns}/${maxTurns}] Business reply sent. Status: ${newTurns >= maxTurns ? "completed" : "continuing"}`
  );

  // --- Step 3: Schedule next turn ---
  if (newTurns < maxTurns) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const delay = 8000 + Math.random() * 12000;
    setTimeout(async () => {
      try {
        await fetch(`${baseUrl}/api/test/simulate/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, userId }),
        });
      } catch (err) {
        console.error("Next turn trigger failed:", err);
      }
    }, delay);
  }

  return NextResponse.json({
    success: true,
    turn: newTurns,
    maxTurns,
    customerReply: customerReply.substring(0, 200),
    businessReply: draft.substring(0, 200),
    status: newTurns >= maxTurns ? "completed" : "active",
  });
}
