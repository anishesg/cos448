import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";
import { getAuthedCalendarClient } from "@/lib/google";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export interface SchedulingIntent {
  hasIntent: boolean;
  meetingType: "call" | "video" | "in_person" | "unknown";
  suggestedDuration: number;
  participants: string[];
  proposedTimes: string[];
  topic: string;
  confidence: number;
}

const intentSchema = {
  type: "object" as const,
  properties: {
    hasIntent: { type: "boolean" as const },
    meetingType: {
      type: "string" as const,
      enum: ["call", "video", "in_person", "unknown"],
    },
    suggestedDuration: {
      type: "number" as const,
      description: "Duration in minutes (15, 30, 45, 60)",
    },
    participants: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Email addresses of participants",
    },
    proposedTimes: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Any times mentioned in the thread (e.g. 'next Tuesday', 'Thursday at 2pm')",
    },
    topic: { type: "string" as const },
    confidence: { type: "number" as const, minimum: 0, maximum: 1 },
  },
  required: ["hasIntent", "meetingType", "suggestedDuration", "participants", "proposedTimes", "topic", "confidence"],
};

export async function detectSchedulingIntent(opts: {
  subject: string;
  snippet: string;
  messages: Array<{ direction: string; body: string | null }>;
  senderEmail: string;
}): Promise<SchedulingIntent> {
  const messageContext = opts.messages
    .slice(-5)
    .map((m) => `[${m.direction}]: ${(m.body ?? "").slice(0, 500)}`)
    .join("\n");

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.HAIKU_4_5,
      system: [{
        text: "Analyze email threads for scheduling intent. Detect if someone wants to meet, call, or schedule something. Extract relevant details.",
      }],
      messages: [{
        role: "user",
        content: [{
          text: `Subject: ${opts.subject}\nSnippet: ${opts.snippet}\nParticipants: ${opts.senderEmail}\n\nMessages:\n${messageContext}`,
        }],
      }],
      toolConfig: {
        tools: [{
          toolSpec: {
            name: "detect_scheduling",
            description: "Detect scheduling intent in an email thread",
            inputSchema: { json: intentSchema },
          },
        }],
        toolChoice: { tool: { name: "detect_scheduling" } },
      },
      inferenceConfig: { maxTokens: 512 },
    })
  );

  const toolUseBlock = response.output?.message?.content?.find(
    (b) => "toolUse" in b
  );
  if (toolUseBlock && "toolUse" in toolUseBlock && toolUseBlock.toolUse?.input) {
    return toolUseBlock.toolUse.input as unknown as SchedulingIntent;
  }

  return {
    hasIntent: false,
    meetingType: "unknown",
    suggestedDuration: 30,
    participants: [],
    proposedTimes: [],
    topic: "",
    confidence: 0,
  };
}

export async function getAvailableSlots(
  userId: string,
  daysAhead: number = 5,
  durationMinutes: number = 30
): Promise<Array<{ start: string; end: string }>> {
  const calendar = await getAuthedCalendarClient(userId);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + daysAhead);

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: endDate.toISOString(),
      items: [{ id: "primary" }],
    },
  });

  const busySlots = data.calendars?.primary?.busy ?? [];

  // Generate available 30-min slots during business hours (9am-5pm ET)
  const slots: Array<{ start: string; end: string }> = [];
  const current = new Date(now);
  current.setMinutes(0, 0, 0);
  if (current.getHours() < 9) current.setHours(9);

  while (current < endDate && slots.length < 10) {
    const hour = current.getHours();
    const day = current.getDay();

    if (day >= 1 && day <= 5 && hour >= 9 && hour < 17) {
      const slotEnd = new Date(current.getTime() + durationMinutes * 60000);
      const isBusy = busySlots.some((busy) => {
        const busyStart = new Date(busy.start!);
        const busyEnd = new Date(busy.end!);
        return current < busyEnd && slotEnd > busyStart;
      });

      if (!isBusy && current > now) {
        slots.push({
          start: current.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
    }

    current.setMinutes(current.getMinutes() + 30);
    if (current.getHours() >= 17) {
      current.setDate(current.getDate() + 1);
      current.setHours(9, 0, 0, 0);
    }
  }

  return slots;
}

export async function createCalendarEvent(opts: {
  userId: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  sendInvites: boolean;
}): Promise<{
  eventId: string;
  htmlLink: string;
  meetLink: string | null;
  hangoutLink: string | null;
}> {
  const calendar = await getAuthedCalendarClient(opts.userId);

  const { data } = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: opts.sendInvites ? "all" : "none",
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.startTime, timeZone: "America/New_York" },
      end: { dateTime: opts.endTime, timeZone: "America/New_York" },
      attendees: opts.attendees.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `clientops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
    conferenceDataVersion: 1,
  });

  const meetLink =
    data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri ?? null;

  return {
    eventId: data.id ?? "",
    htmlLink: data.htmlLink ?? "",
    meetLink,
    hangoutLink: data.hangoutLink ?? null,
  };
}

export async function addBlockerEvents(userId: string) {
  const calendar = await getAuthedCalendarClient(userId);
  const now = new Date();

  const blockers = [
    {
      summary: "Sell arms in Ethiopia",
      dayOffset: 0,
      startHour: 10,
      durationHours: 1.5,
    },
    {
      summary: "Reserved focus block (placeholder)",
      dayOffset: 0,
      startHour: 14,
      durationHours: 2,
    },
    {
      summary: "Batman cave equipment inspection",
      dayOffset: 1,
      startHour: 9,
      durationHours: 1,
    },
    {
      summary: "Secret underground poker tournament",
      dayOffset: 1,
      startHour: 13,
      durationHours: 3,
    },
    {
      summary: "Negotiate ransom with Gotham City PD",
      dayOffset: 1,
      startHour: 16,
      durationHours: 1,
    },
    {
      summary: "Launder money through car wash (Breaking Bad cosplay)",
      dayOffset: 2,
      startHour: 11,
      durationHours: 2,
    },
    {
      summary: "Smuggle exotic birds across state lines",
      dayOffset: 2,
      startHour: 15,
      durationHours: 1.5,
    },
    {
      summary: "Test drive stolen Batmobile",
      dayOffset: 3,
      startHour: 10,
      durationHours: 1,
    },
    {
      summary: "Interview henchmen (must bring own cape)",
      dayOffset: 3,
      startHour: 14,
      durationHours: 2,
    },
    {
      summary: "Attend villain mixer at Arkham Asylum",
      dayOffset: 4,
      startHour: 12,
      durationHours: 1.5,
    },
  ];

  const created = [];
  for (const b of blockers) {
    const start = new Date(now);
    start.setDate(start.getDate() + b.dayOffset);
    start.setHours(b.startHour, 0, 0, 0);
    const end = new Date(start.getTime() + b.durationHours * 3600000);

    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: b.summary,
        start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
        end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
        colorId: "11",
      },
    });
    created.push({ id: data.id, summary: b.summary, start: start.toISOString() });
  }
  return created;
}
