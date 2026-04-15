import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { getAuthedCalendarClient } from "@/lib/google";
import { db } from "@/lib/db";
import {
  meetingBriefs,
  emailThreads,
  contacts,
  userProfiles,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateMeetingBrief } from "@/lib/agents/briefing-agent";

export async function GET() {
  try {
    const session = await requireApiUser();

    try {
      const calendar = await getAuthedCalendarClient(session.userId);

      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { data } = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 10,
      });

      const events =
        data.items?.map((event) => ({
          id: event.id ?? "",
          summary: event.summary ?? "Untitled",
          start: { dateTime: event.start?.dateTime ?? event.start?.date ?? "" },
          end: { dateTime: event.end?.dateTime ?? event.end?.date ?? "" },
          attendees:
            event.attendees?.map((a) => ({
              email: a.email ?? "",
              displayName: a.displayName ?? undefined,
            })).filter((a) => a.email) ?? [],
          meetLink: event.hangoutLink ?? null,
          location: event.location ?? null,
        })) ?? [];

      // Check for existing briefs
      const briefs = await db
        .select()
        .from(meetingBriefs)
        .where(eq(meetingBriefs.userId, session.userId));

      const briefMap = new Map(
        briefs.map((b) => [b.calendarEventId, b.briefContent])
      );

      const enrichedEvents = events.map((event) => {
        const briefContent = briefMap.get(event.id);
        return {
          ...event,
          brief: briefContent ? { briefContent } : null,
        };
      });

      return NextResponse.json({ events: enrichedEvents });
    } catch (error) {
      console.error("Calendar fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch calendar" },
        { status: 500 }
      );
    }
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Meeting briefs GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser();
    const { eventId, eventTitle, eventTime, duration, attendees } =
      await request.json();

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, session.userId))
    .limit(1);

  // Find related thread/contact history from attendee emails
  let threadHistory = "No prior email history found.";
  let contactInfo = "No contact info available.";

  for (const email of attendees ?? []) {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, session.userId),
          eq(contacts.email, email)
        )
      )
      .limit(1);

    if (contact) {
      contactInfo = `Name: ${contact.name ?? "Unknown"}, Company: ${contact.company ?? "Unknown"}, Role: ${contact.role ?? "Unknown"}, Relationship: ${contact.relationshipType ?? "Unknown"}, Fit score: ${contact.fitScore ?? "N/A"}`;

      const threads = await db
        .select()
        .from(emailThreads)
        .where(eq(emailThreads.contactId, contact.id))
        .limit(3);

      if (threads.length > 0) {
        threadHistory = threads
          .map(
            (t) =>
              `Thread: "${t.subject}" — ${t.businessCategory ?? "uncategorized"}, ${t.urgency ?? "unknown"} urgency. ${t.snippet ?? ""}`
          )
          .join("\n");
      }
      break;
    }
  }

  const brief = await generateMeetingBrief({
    eventTitle: eventTitle ?? "Meeting",
    eventTime: eventTime ?? "",
    duration: duration ?? "30 min",
    attendees: attendees ?? [],
    threadHistory,
    contactInfo,
    businessType: user?.businessType ?? undefined,
    founderName: user?.name ?? undefined,
  });

  // Store the brief
  await db
    .insert(meetingBriefs)
    .values({
      userId: session.userId,
      calendarEventId: eventId,
      briefContent: { markdown: brief } as Record<string, unknown>,
    })
    .onConflictDoNothing();

    return NextResponse.json({ brief });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Meeting briefs POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** Remove event from Google Calendar and drop any stored brief for this user. */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireApiUser();
    let eventId: string | undefined;
    try {
      const body = (await request.json()) as { eventId?: string };
      eventId = typeof body.eventId === "string" ? body.eventId.trim() : undefined;
    } catch {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const calendar = await getAuthedCalendarClient(session.userId);
    try {
      await calendar.events.delete({ calendarId: "primary", eventId });
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status !== 404) throw err;
    }

    await db
      .delete(meetingBriefs)
      .where(
        and(eq(meetingBriefs.userId, session.userId), eq(meetingBriefs.calendarEventId, eventId))
      );

    return NextResponse.json({ ok: true, deletedEventId: eventId });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Meeting briefs DELETE error:", e);
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
