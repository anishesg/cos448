import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCalendarEvent } from "@/lib/agents/scheduling-agent";
import { getAuthedGmailClient } from "@/lib/google";

/**
 * POST /api/demo
 * Performs real side effects for the demo: sends an email and/or creates a calendar event.
 * Body: { action: "send_email" | "create_event", ...params }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { action } = body;

    if (action === "send_email") {
      const { to, subject, emailBody } = body;
      if (!to || !emailBody) {
        return NextResponse.json(
          { error: "to and emailBody are required" },
          { status: 400 },
        );
      }

      const gmail = await getAuthedGmailClient(user.userId);
      const raw = [
        `To: ${to}`,
        `Subject: ${subject || "(no subject)"}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        emailBody,
      ].join("\r\n");

      const encoded = Buffer.from(raw)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const { data } = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
      });

      return NextResponse.json({ success: true, messageId: data.id });
    }

    if (action === "create_event") {
      const { summary, description, startTime, endTime, attendees } = body;
      if (!summary || !startTime || !endTime) {
        return NextResponse.json(
          { error: "summary, startTime, endTime required" },
          { status: 400 },
        );
      }

      const event = await createCalendarEvent({
        userId: user.userId,
        summary,
        description,
        startTime,
        endTime,
        attendees: attendees ?? [],
        sendInvites: false,
      });

      return NextResponse.json({ success: true, event });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[demo route]", err);
    return NextResponse.json(
      { error: "Demo action failed" },
      { status: 500 },
    );
  }
}
