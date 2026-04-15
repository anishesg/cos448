import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailThreads, agentActions, emailMessages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthedGmailClient } from "@/lib/google";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await requireUser();
  const { threadId } = await params;
  const reqBody = await request.json();
  const content = reqBody.content ?? reqBody.body;
  const actionId = reqBody.actionId;

  if (!content) {
    return NextResponse.json({ error: "No content provided" }, { status: 400 });
  }

  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.id, threadId),
        eq(emailThreads.userId, session.userId)
      )
    )
    .limit(1);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    const gmail = await getAuthedGmailClient(session.userId);

    const messages = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.threadId, threadId))
      .orderBy(emailMessages.sentAt);

    const lastInbound = [...messages]
      .reverse()
      .find((m) => m.direction === "inbound");
    const to = lastInbound?.senderEmail ?? "";
    const subject = thread.subject ?? "";

    const rawMessage = [
      `To: ${to}`,
      `Subject: Re: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      content,
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

    // Store sent message
    if (sent.id) {
      await db.insert(emailMessages).values({
        threadId,
        gmailMessageId: sent.id,
        direction: "outbound",
        senderEmail: session.email,
        senderName: session.name,
        bodySummary: content.substring(0, 200),
        bodyFull: content,
        sentAt: new Date(),
        isAgentGenerated: true,
        agentActionId: actionId ?? null,
      });
    }

    // Update thread state
    await db
      .update(emailThreads)
      .set({
        currentState: "awaiting_response",
        lastMessageAt: new Date(),
        lastMessageDirection: "outbound",
        updatedAt: new Date(),
      })
      .where(eq(emailThreads.id, threadId));

    // Update agent action if provided
    if (actionId) {
      await db
        .update(agentActions)
        .set({ status: "completed" })
        .where(eq(agentActions.id, actionId));
    }

    return NextResponse.json({ success: true, messageId: sent.id });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
