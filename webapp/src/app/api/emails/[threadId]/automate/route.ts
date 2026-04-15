import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  emailThreads,
  emailMessages,
  agentActions,
  userProfiles,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthedGmailClient } from "@/lib/google";
import { generateDraft } from "@/lib/agents/draft-agent";
import { extractWritingStyle } from "@/lib/agents/tone-extractor";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await requireUser();
  const { threadId } = await params;

  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(
      and(eq(emailThreads.id, threadId), eq(emailThreads.userId, session.userId))
    )
    .limit(1);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, session.userId))
    .limit(1);

  const messages = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(emailMessages.sentAt);

  const writingStyle = (user?.onboardingAnswers as Record<string, unknown>)
    ?.writingStyle as { summary?: string; tone?: string; signOff?: string; traits?: string[]; avoidances?: string[] } | undefined;

  const styleContext = writingStyle
    ? `\n\nMatch the founder's writing style exactly:
${writingStyle.summary}
Tone: ${writingStyle.tone}
Sign off: ${writingStyle.signOff}
Traits: ${writingStyle.traits?.join(", ")}
NEVER use: ${writingStyle.avoidances?.join(", ")}`
    : "\n\nWrite in a friendly, human tone. No em dashes. Sound informed and helpful.";

  const draft = await generateDraft({
    threadSubject: thread.subject ?? "",
    threadSnippet: thread.snippet ?? "",
    messageHistory: messages.map((m) => ({
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

  const lastInbound = [...messages]
    .reverse()
    .find((m) => m.direction === "inbound");

  const gmail = await getAuthedGmailClient(session.userId);

  const recipientEmail = lastInbound?.senderEmail ?? "";
  const subject = thread.subject ?? "";

  const rawMessage = [
    `To: ${recipientEmail}`,
    `Subject: Re: ${subject}`,
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
      senderEmail: session.email,
      senderName: session.name,
      bodySummary: draft.substring(0, 200),
      bodyFull: draft,
      sentAt: new Date(),
      isAgentGenerated: true,
    });
  }

  await db.insert(agentActions).values({
    userId: session.userId,
    threadId,
    actionType: "automation_reply",
    agentName: "automate-agent",
    output: { draft, recipientEmail, messageId: sent.id } as Record<string, unknown>,
    status: "completed",
    modelUsed: "us.anthropic.claude-sonnet-4-6",
  });

  await db
    .update(emailThreads)
    .set({
      automationStatus: "active",
      automationTurns: (thread.automationTurns ?? 0) + 1,
      currentState: "automated",
      lastMessageAt: new Date(),
      lastMessageDirection: "outbound",
      updatedAt: new Date(),
    })
    .where(eq(emailThreads.id, threadId));

  if (thread.isTestSimulation) {
    triggerCustomerReply(threadId, session.userId).catch(console.error);
  }

  return NextResponse.json({
    success: true,
    draft,
    messageId: sent.id,
    automationStatus: "active",
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await requireUser();
  const { threadId } = await params;

  await db
    .update(emailThreads)
    .set({
      automationStatus: "paused",
      updatedAt: new Date(),
    })
    .where(
      and(eq(emailThreads.id, threadId), eq(emailThreads.userId, session.userId))
    );

  return NextResponse.json({ success: true, automationStatus: "paused" });
}

async function triggerCustomerReply(threadId: string, userId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const delay = 15000 + Math.random() * 15000;
  await new Promise((r) => setTimeout(r, delay));

  await fetch(`${baseUrl}/api/test/simulate/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, userId }),
  });
}
