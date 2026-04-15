import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAuthedCalendarClient } from "@/lib/google";
import { db } from "@/lib/db";
import {
  meetingBriefs,
  emailThreads,
  contacts,
  emailMessages,
  userProfiles,
} from "@/lib/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { generateMeetingBrief } from "@/lib/agents/briefing-agent";

export async function GET() {
  const session = await requireUser();

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
        title: event.summary ?? "Untitled",
        start: event.start?.dateTime ?? event.start?.date ?? "",
        end: event.end?.dateTime ?? event.end?.date ?? "",
        attendees:
          event.attendees?.map((a) => a.email ?? "").filter(Boolean) ?? [],
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

    const enrichedEvents = events.map((event) => ({
      ...event,
      brief: briefMap.get(event.id) ?? null,
    }));

    return NextResponse.json({ events: enrichedEvents });
  } catch (error) {
    console.error("Calendar fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await requireUser();
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
}
