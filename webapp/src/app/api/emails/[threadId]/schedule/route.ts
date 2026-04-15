import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  emailThreads,
  emailMessages,
  agentActions,
  contacts,
  userProfiles,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  detectSchedulingIntent,
  getAvailableSlots,
  createCalendarEvent,
} from "@/lib/agents/scheduling-agent";
import { getAuthedGmailClient } from "@/lib/google";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser();
  const { threadId } = await params;

  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(
      and(eq(emailThreads.id, threadId), eq(emailThreads.userId, user.userId))
    )
    .limit(1);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId));

  const lastInbound = messages.filter((m) => m.direction === "inbound").pop();

  const intent = await detectSchedulingIntent({
    subject: thread.subject ?? "",
    snippet: thread.snippet ?? "",
    messages: messages.map((m) => ({
      direction: m.direction,
      body: m.bodyFull ?? m.bodySummary,
    })),
    senderEmail: lastInbound?.senderEmail ?? "",
  });

  const slots = intent.hasIntent
    ? await getAvailableSlots(user.userId, 5, intent.suggestedDuration)
    : [];

  return NextResponse.json({ intent, slots });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser();
  const { threadId } = await params;
  const body = await request.json();

  const { summary, startTime, endTime, attendees, sendInvites = true } = body;

  if (!summary || !startTime || !endTime) {
    return NextResponse.json(
      { error: "summary, startTime, and endTime are required" },
      { status: 400 }
    );
  }

  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(
      and(eq(emailThreads.id, threadId), eq(emailThreads.userId, user.userId))
    )
    .limit(1);

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const event = await createCalendarEvent({
    userId: user.userId,
    summary,
    startTime,
    endTime,
    attendees: attendees ?? [],
    sendInvites,
  });

  await db.insert(agentActions).values({
    userId: user.userId,
    threadId,
    actionType: "schedule_meeting",
    agentName: "scheduling-agent",
    output: {
      event,
      summary,
      attendees,
      meetLink: event.meetLink,
    } as Record<string, unknown>,
    status: "completed",
  });

  await db
    .update(emailThreads)
    .set({
      currentState: "meeting_scheduled",
      agentObjective: "meeting_booked",
      updatedAt: new Date(),
    })
    .where(eq(emailThreads.id, threadId));

  // Send confirmation email with the Meet link
  if (event.meetLink && attendees?.length > 0) {
    try {
      const gmail = await getAuthedGmailClient(user.userId);
      const [userRow] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, user.userId))
        .limit(1);

      const startDate = new Date(startTime);
      const dateStr = startDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const timeStr = startDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      const emailBody = [
        `Hey! Just wanted to confirm our meeting:`,
        ``,
        `${summary}`,
        `${dateStr} at ${timeStr}`,
        ``,
        `Join via Google Meet: ${event.meetLink}`,
        ``,
        `Looking forward to it!`,
        `${userRow?.name ?? ""}`,
      ].join("\n");

      const to = attendees[0];
      const raw = [
        `To: ${to}`,
        `Subject: Meeting confirmed: ${summary}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        emailBody,
      ].join("\r\n");
      const encoded = Buffer.from(raw)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encoded,
          threadId: thread.gmailThreadId,
        },
      });
    } catch (err) {
      console.error("Failed to send meeting confirmation email:", err);
    }
  }

  return NextResponse.json({ event });
}
