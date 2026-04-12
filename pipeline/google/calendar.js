import { google } from "googleapis";
import { config } from "../config.js";

/**
 * List calendar events in a time range.
 */
export async function listCalendarEvents(auth, timeMin, timeMax, maxResults = 50) {
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults,
  });
  return response.data.items || [];
}

/**
 * Build busy windows from calendar events.
 */
export function buildBusyWindows(events) {
  return events
    .map((event) => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      if (!start || !end) return null;
      return { startsAt: new Date(start), endsAt: new Date(end) };
    })
    .filter(Boolean)
    .sort((a, b) => a.startsAt - b.startsAt);
}

function roundUpToHalfHour(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  if (mins === 0 || mins === 30) return d;
  if (mins < 30) {
    d.setMinutes(30);
  } else {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  }
  return d;
}

function overlaps(start, end, busy) {
  return start < busy.endsAt && end > busy.startsAt;
}

/**
 * Get the day-of-week for a date in the configured timezone.
 * Returns 0=Sun, 1=Mon, ..., 6=Sat.
 */
function getDayOfWeekInTz(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: config.timezone,
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? date.getDay();
}

/**
 * Find the next available meeting slot.
 * Only considers allowed days (Sun-Wed by default) within the
 * configured time window (5-10 PM ET by default).
 */
export async function findNextAvailableSlot(auth) {
  const { durationMinutes, windowStartHour, windowEndHour, horizonDays, allowedDays } = config.meeting;

  const now = new Date();
  const horizonEnd = new Date(now);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  const events = await listCalendarEvents(auth, now, horizonEnd, 150);
  const busyWindows = buildBusyWindows(events);

  for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);

    // Skip days not in the allowed set
    if (!allowedDays.includes(getDayOfWeekInTz(day))) continue;

    const dayStart = new Date(day);
    dayStart.setHours(windowStartHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(windowEndHour, 0, 0, 0);

    // Skip past times for today
    let cursor = dayOffset === 0
      ? roundUpToHalfHour(new Date(Math.max(now.getTime(), dayStart.getTime())))
      : dayStart;

    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
      if (slotEnd > dayEnd) break;

      const blocking = busyWindows.find((w) => overlaps(cursor, slotEnd, w));
      if (blocking) {
        cursor = roundUpToHalfHour(blocking.endsAt);
        continue;
      }

      return { startsAt: cursor.toISOString(), endsAt: slotEnd.toISOString() };
    }
  }

  return null; // no slot found in horizon
}

/**
 * Create a calendar event with a Google Meet link.
 */
export async function createMeetingEvent(auth, { summary, description, startsAt, endsAt, attendeeEmails }) {
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary,
      description: description || undefined,
      start: { dateTime: startsAt, timeZone: config.timezone },
      end: { dateTime: endsAt, timeZone: config.timezone },
      attendees: attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `pipeline-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 10 },
        ],
      },
    },
  });

  const event = response.data;
  const meetLink =
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    event.hangoutLink ||
    null;

  return {
    eventId: event.id,
    htmlLink: event.htmlLink,
    meetLink,
  };
}
