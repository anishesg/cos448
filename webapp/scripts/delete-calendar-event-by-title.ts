/**
 * Delete a Google Calendar primary event by title substring and remove matching meeting_briefs.
 *
 * Usage (from repo root):
 *   set -a && source .env && set +a && cd webapp && npx tsx scripts/delete-calendar-event-by-title.ts
 *
 * Optional: USER_EMAIL=user@example.com npx tsx ...
 * Optional: TITLE_MATCH="CIA mainframe" (default matches hack/cia/mainframe heuristics)
 */
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { googleTokens, meetingBriefs, userProfiles } from "../src/lib/db/schema";
import { getAuthedCalendarClient } from "../src/lib/google";

const DEFAULT_TITLE_NEEDLES = ["cia mainframe", "hack the cia"];

function matchesTitle(summary: string | null | undefined, custom?: string): boolean {
  if (!summary) return false;
  const s = summary.toLowerCase();
  if (custom?.trim()) return s.includes(custom.trim().toLowerCase());
  return DEFAULT_TITLE_NEEDLES.every((n) => s.includes(n));
}

async function main() {
  const customMatch = process.env.TITLE_MATCH?.trim();
  const wantEmail = process.env.USER_EMAIL?.trim().toLowerCase();

  const users = await db
    .select({
      userId: userProfiles.id,
      email: userProfiles.email,
    })
    .from(userProfiles)
    .innerJoin(googleTokens, eq(googleTokens.userId, userProfiles.id));

  const picked = wantEmail
    ? users.filter((u) => u.email.toLowerCase() === wantEmail)
    : users;

  if (picked.length === 0) {
    console.error(
      wantEmail
        ? `No user with Google tokens found for USER_EMAIL=${wantEmail}`
        : "No users with Google tokens found."
    );
    process.exit(1);
  }

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 1);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);

  let deleted = 0;
  for (const { userId, email } of picked) {
    const calendar = await getAuthedCalendarClient(userId);
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin: windowStart.toISOString(),
      timeMax: horizon.toISOString(),
      singleEvents: true,
      maxResults: 250,
    });

    const items = data.items ?? [];
    const hits = items.filter((e) => matchesTitle(e.summary, customMatch));
    if (hits.length === 0) {
      console.log(`[${email}] No matching events in next 14 days.`);
      continue;
    }

    for (const ev of hits) {
      const id = ev.id;
      if (!id) continue;
      console.log(`[${email}] Deleting calendar event: "${ev.summary}" (${id})`);
      await calendar.events.delete({ calendarId: "primary", eventId: id });
      const br = await db
        .delete(meetingBriefs)
        .where(and(eq(meetingBriefs.userId, userId), eq(meetingBriefs.calendarEventId, id)))
        .returning({ id: meetingBriefs.id });
      if (br.length) console.log(`  Removed ${br.length} meeting_briefs row(s).`);
      deleted += 1;
    }
  }

  if (deleted === 0) {
    console.log("No events deleted. Try TITLE_MATCH='Hack the CIA' or widen the date window in the script.");
    process.exit(0);
  }
  console.log(`Done. Deleted ${deleted} calendar event(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
