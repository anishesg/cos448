import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAuthedGmailClient } from "@/lib/google";
import { db } from "@/lib/db";
import { emailThreads, emailMessages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getCleanBody,
  decodeHtmlEntities,
  getHeader,
  parseSender,
} from "@/lib/gmail-parser";
import { TEST_PERSONAS } from "@/lib/agents/customer-simulator";

const TEST_EMAILS = new Set(Object.values(TEST_PERSONAS).map((p) => p.email));

const MAX_PAGES = 4;
const PAGE_SIZE = 50;

export async function POST() {
  const user = await requireUser();

  try {
    const gmail = await getAuthedGmailClient(user.userId);

    let allThreadRefs: Array<{ id?: string | null }> = [];
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await gmail.users.threads.list({
        userId: "me",
        maxResults: PAGE_SIZE,
        q: "in:inbox",
        pageToken,
      });

      if (data.threads?.length) {
        allThreadRefs.push(...data.threads);
      }

      pageToken = data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    if (!allThreadRefs.length) {
      return NextResponse.json({ synced: 0, updated: 0, total: 0 });
    }

    let syncedCount = 0;
    let updatedCount = 0;

    for (const threadRef of allThreadRefs) {
      if (!threadRef.id) continue;

      try {
        const { data: fullThread } = await gmail.users.threads.get({
          userId: "me",
          id: threadRef.id,
          format: "full",
        });

        if (!fullThread.messages?.length) continue;

        const firstMsg = fullThread.messages[0];
        const lastMsg = fullThread.messages[fullThread.messages.length - 1];

        const subject = decodeHtmlEntities(
          getHeader(firstMsg, "Subject") ?? "(no subject)"
        );
        const lastFrom = getHeader(lastMsg, "From") ?? "";
        const lastDate = getHeader(lastMsg, "Date");
        const isInbound = !lastFrom
          .toLowerCase()
          .includes(user.email.toLowerCase());

        const snippet = decodeHtmlEntities(fullThread.snippet ?? "");

        const existing = await db
          .select({ id: emailThreads.id })
          .from(emailThreads)
          .where(
            and(
              eq(emailThreads.userId, user.userId),
              eq(emailThreads.gmailThreadId, threadRef.id)
            )
          )
          .limit(1);

        let threadDbId: string;

        if (existing.length > 0) {
          threadDbId = existing[0].id;
          await db
            .update(emailThreads)
            .set({
              subject,
              snippet,
              lastMessageAt: lastDate ? new Date(lastDate) : new Date(),
              lastMessageDirection: isInbound ? "inbound" : "outbound",
              messageCount: fullThread.messages.length,
              updatedAt: new Date(),
            })
            .where(eq(emailThreads.id, threadDbId));
          updatedCount++;
        } else {
          const { email: firstSenderEmail } = parseSender(
            getHeader(firstMsg, "From") ?? ""
          );
          const isTestSim = TEST_EMAILS.has(firstSenderEmail);

          const [newThread] = await db
            .insert(emailThreads)
            .values({
              userId: user.userId,
              gmailThreadId: threadRef.id,
              subject,
              snippet,
              lastMessageAt: lastDate ? new Date(lastDate) : new Date(),
              lastMessageDirection: isInbound ? "inbound" : "outbound",
              messageCount: fullThread.messages.length,
              isTestSimulation: isTestSim,
            })
            .returning({ id: emailThreads.id });
          threadDbId = newThread.id;
          syncedCount++;
        }

        // Upsert messages for all threads (new and existing)
        for (const msg of fullThread.messages) {
          if (!msg.id) continue;

          const msgFrom = getHeader(msg, "From") ?? "";
          const msgDate = getHeader(msg, "Date");
          const msgDirection = msgFrom
            .toLowerCase()
            .includes(user.email.toLowerCase())
            ? "outbound"
            : "inbound";

          const { name: senderName, email: senderEmail } = parseSender(msgFrom);
          const bodyFull = getCleanBody(msg.payload);
          const bodySummary = decodeHtmlEntities(msg.snippet ?? "");

          await db
            .insert(emailMessages)
            .values({
              threadId: threadDbId,
              gmailMessageId: msg.id,
              direction: msgDirection,
              senderEmail,
              senderName,
              bodySummary,
              bodyFull,
              sentAt: msgDate ? new Date(msgDate) : null,
            })
            .onConflictDoNothing();
        }
      } catch (threadErr) {
        console.error(`Failed to sync thread ${threadRef.id}:`, threadErr);
      }
    }

    return NextResponse.json({
      synced: syncedCount,
      updated: updatedCount,
      total: allThreadRefs.length,
    });
  } catch (error) {
    console.error("Email sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
