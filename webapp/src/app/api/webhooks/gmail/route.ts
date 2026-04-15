import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  emailThreads,
  emailMessages,
  userProfiles,
  googleTokens,
  agentActions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { classifyEmail } from "@/lib/agents/triage-agent";
import { generateDraft } from "@/lib/agents/draft-agent";
import { google } from "googleapis";
import {
  getCleanBody,
  decodeHtmlEntities,
  getHeader as getHeaderUtil,
  parseSender,
} from "@/lib/gmail-parser";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message?.data) {
      return NextResponse.json({ error: "No message data" }, { status: 400 });
    }

    const decoded = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf-8")
    );
    const { emailAddress } = decoded;

    if (!emailAddress) {
      return NextResponse.json(
        { error: "No email address" },
        { status: 400 }
      );
    }

    const [user] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.email, emailAddress))
      .limit(1);

    if (!user) {
      return NextResponse.json({ status: "user_not_found" });
    }

    const [tokens] = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, user.id))
      .limit(1);

    if (!tokens) {
      return NextResponse.json({ status: "no_tokens" });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.tokenExpiry?.getTime(),
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const { data: threadList } = await gmail.users.threads.list({
      userId: "me",
      maxResults: 10,
      q: "in:inbox newer_than:1h",
    });

    if (!threadList.threads?.length) {
      return NextResponse.json({ status: "no_new_threads" });
    }

    let classified = 0;
    const automatedReplies: string[] = [];

    for (const threadRef of threadList.threads) {
      if (!threadRef.id) continue;

      const { data: fullThread } = await gmail.users.threads.get({
        userId: "me",
        id: threadRef.id,
        format: "full",
      });

      if (!fullThread.messages?.length) continue;

      const firstMsg = fullThread.messages[0];
      const lastMsg = fullThread.messages[fullThread.messages.length - 1];

      const subject = decodeHtmlEntities(
        getHeaderUtil(firstMsg, "Subject") ?? "(no subject)"
      );
      const lastFrom = getHeaderUtil(lastMsg, "From") ?? "";
      const lastDate = getHeaderUtil(lastMsg, "Date");
      const isInbound = !lastFrom.toLowerCase().includes(user.email.toLowerCase());
      const { name: senderName, email: senderEmail } = parseSender(lastFrom);

      const existing = await db
        .select()
        .from(emailThreads)
        .where(
          and(
            eq(emailThreads.userId, user.id),
            eq(emailThreads.gmailThreadId, threadRef.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const dbThread = existing[0];

        for (const msg of fullThread.messages) {
          if (!msg.id) continue;
          const msgFrom = getHeaderUtil(msg, "From") ?? "";
          const msgDate = getHeaderUtil(msg, "Date");
          const { name: mName, email: mEmail } = parseSender(msgFrom);
          await db
            .insert(emailMessages)
            .values({
              threadId: dbThread.id,
              gmailMessageId: msg.id,
              direction: msgFrom.toLowerCase().includes(user.email.toLowerCase())
                ? "outbound"
                : "inbound",
              senderEmail: mEmail,
              senderName: mName,
              bodySummary: decodeHtmlEntities(msg.snippet ?? ""),
              bodyFull: getCleanBody(msg.payload),
              sentAt: msgDate ? new Date(msgDate) : null,
            })
            .onConflictDoNothing();
        }

        await db
          .update(emailThreads)
          .set({
            snippet: decodeHtmlEntities(fullThread.snippet ?? ""),
            lastMessageAt: lastDate ? new Date(lastDate) : new Date(),
            lastMessageDirection: isInbound ? "inbound" : "outbound",
            messageCount: fullThread.messages.length,
            updatedAt: new Date(),
          })
          .where(eq(emailThreads.id, dbThread.id));

        if (dbThread.automationStatus === "active" && isInbound) {
          try {
            await handleAutomatedReply(
              dbThread,
              user,
              gmail,
              fullThread,
              senderEmail
            );
            automatedReplies.push(dbThread.id);
          } catch (err) {
            console.error("Automation reply failed:", err);
          }
        }

        continue;
      }

      const classification = await classifyEmail({
        subject,
        snippet: fullThread.snippet ?? "",
        senderEmail,
        senderName,
        messageCount: fullThread.messages.length,
        direction: isInbound ? "inbound" : "outbound",
        businessType: user.businessType ?? undefined,
      });

      const [newThread] = await db
        .insert(emailThreads)
        .values({
          userId: user.id,
          gmailThreadId: threadRef.id,
          subject,
          snippet: decodeHtmlEntities(fullThread.snippet ?? ""),
          businessCategory: classification.businessCategory,
          urgency: classification.urgency,
          businessLeverage: classification.businessLeverage,
          currentState:
            classification.recommendedAction === "hide"
              ? "hidden"
              : "classified",
          agentObjective: classification.agentObjective,
          lastMessageAt: lastDate ? new Date(lastDate) : new Date(),
          lastMessageDirection: isInbound ? "inbound" : "outbound",
          messageCount: fullThread.messages.length,
          classification: classification as unknown as Record<string, unknown>,
        })
        .returning({ id: emailThreads.id });

      for (const msg of fullThread.messages) {
        if (!msg.id) continue;
        const msgFrom = getHeaderUtil(msg, "From") ?? "";
        const msgDate = getHeaderUtil(msg, "Date");
        const { name: mName, email: mEmail } = parseSender(msgFrom);
        await db
          .insert(emailMessages)
          .values({
            threadId: newThread.id,
            gmailMessageId: msg.id,
            direction: msgFrom.toLowerCase().includes(user.email.toLowerCase())
              ? "outbound"
              : "inbound",
            senderEmail: mEmail,
            senderName: mName,
            bodySummary: decodeHtmlEntities(msg.snippet ?? ""),
            bodyFull: getCleanBody(msg.payload),
            sentAt: msgDate ? new Date(msgDate) : null,
          })
          .onConflictDoNothing();
      }

      classified++;
    }

    return NextResponse.json({ status: "ok", classified, automatedReplies });
  } catch (error) {
    console.error("Gmail webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleAutomatedReply(
  dbThread: typeof emailThreads.$inferSelect,
  user: typeof userProfiles.$inferSelect,
  gmail: ReturnType<typeof google.gmail>,
  fullThread: { messages?: Array<{ id?: string | null; payload?: unknown; snippet?: string | null }>; snippet?: string | null },
  recipientEmail: string
) {
  const turns = (dbThread.automationTurns ?? 0) + 1;
  const maxTurns = dbThread.automationMaxTurns ?? 8;

  if (turns > maxTurns) {
    await db
      .update(emailThreads)
      .set({ automationStatus: "completed", updatedAt: new Date() })
      .where(eq(emailThreads.id, dbThread.id));
    return;
  }

  const messages = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, dbThread.id))
    .orderBy(emailMessages.sentAt);

  const writingStyle = (user.onboardingAnswers as Record<string, unknown>)
    ?.writingStyle as { summary?: string; tone?: string; signOff?: string; traits?: string[]; avoidances?: string[] } | undefined;

  const styleContext = writingStyle
    ? `\nMatch the founder's writing style:
${writingStyle.summary}
Tone: ${writingStyle.tone}
Sign off: ${writingStyle.signOff}
NEVER use: ${writingStyle.avoidances?.join(", ")}`
    : "\nWrite in a friendly, human tone. No em dashes. Sound informed.";

  const draft = await generateDraft({
    threadSubject: dbThread.subject ?? "",
    threadSnippet: dbThread.snippet ?? "",
    messageHistory: messages.map((m) => ({
      direction: m.direction,
      senderName: m.senderName,
      bodySummary: m.bodyFull ?? m.bodySummary,
      sentAt: m.sentAt?.toISOString() ?? null,
    })),
    classification: dbThread.classification as Record<string, string> | null,
    businessType: user.businessType ?? "college consulting",
    founderName: user.name ?? undefined,
    businessContext: styleContext,
  });

  const rawMessage = [
    `To: ${recipientEmail}`,
    `Subject: Re: ${dbThread.subject}`,
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
      threadId: dbThread.gmailThreadId,
    },
  });

  if (sent.id) {
    await db.insert(emailMessages).values({
      threadId: dbThread.id,
      gmailMessageId: sent.id,
      direction: "outbound",
      senderEmail: user.email,
      senderName: user.name,
      bodySummary: draft.substring(0, 200),
      bodyFull: draft,
      sentAt: new Date(),
      isAgentGenerated: true,
    });
  }

  await db.insert(agentActions).values({
    userId: user.id,
    threadId: dbThread.id,
    actionType: "automation_reply",
    agentName: "automate-agent",
    output: { draft, turn: turns } as Record<string, unknown>,
    status: "completed",
    modelUsed: "us.anthropic.claude-sonnet-4-6",
  });

  await db
    .update(emailThreads)
    .set({
      automationTurns: turns,
      lastMessageAt: new Date(),
      lastMessageDirection: "outbound",
      updatedAt: new Date(),
    })
    .where(eq(emailThreads.id, dbThread.id));

  if (dbThread.isTestSimulation && turns < maxTurns) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const delay = 15000 + Math.random() * 15000;
    setTimeout(async () => {
      try {
        await fetch(`${baseUrl}/api/test/simulate/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: dbThread.id, userId: user.id }),
        });
      } catch (err) {
        console.error("Customer simulation trigger failed:", err);
      }
    }, delay);
  }
}
