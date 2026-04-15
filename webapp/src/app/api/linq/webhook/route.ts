/**
 * POST /api/linq/webhook
 *
 * Receives incoming iMessage events from the Linq API, runs the linq-agent,
 * and sends the response back to the sender.
 */

import { NextRequest, NextResponse } from "next/server";
import { runLinqAgent } from "@/lib/linq/linq-agent";
import { sendImessage } from "@/lib/linq/linq-client";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type UnknownRecord = Record<string, unknown>;

function getEventType(body: UnknownRecord): string | undefined {
  const t = body.event_type ?? body.event;
  return typeof t === "string" ? t : undefined;
}

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p): p is UnknownRecord => Boolean(p) && typeof p === "object")
    .filter((p) => p.type === "text")
    .map((p) => {
      if (typeof p.value === "string") return p.value;
      if (typeof p.content === "string") return p.content;
      return "";
    })
    .join("");
}

/**
 * Normalize Linq webhook v1 (MessageEvent) and v2 (MessageEventV2) payloads.
 */
function parseInboundMessage(body: UnknownRecord): {
  text: string;
  senderHandle: string;
} | null {
  const data = body.data;
  if (!data || typeof data !== "object") return null;
  const d = data as UnknownRecord;

  // v2: parts + sender_handle on `data`, direction === inbound
  if (d.direction === "inbound" && d.sender_handle && typeof d.sender_handle === "object") {
    const handle = (d.sender_handle as UnknownRecord).handle;
    const text = textFromParts(d.parts).trim();
    if (!text || typeof handle !== "string") return null;
    return { text, senderHandle: handle };
  }

  // v1: nested message.parts + from_handle on `data`
  const msg = d.message;
  if (msg && typeof msg === "object") {
    const m = msg as UnknownRecord;
    const text =
      (typeof m.text === "string" ? m.text : textFromParts(m.parts)).trim();
    const fromHandle =
      d.from_handle && typeof d.from_handle === "object"
        ? ((d.from_handle as UnknownRecord).handle as string | undefined)
        : undefined;
    const legacySender =
      m.sender && typeof m.sender === "object"
        ? ((m.sender as UnknownRecord).handle as string | undefined)
        : undefined;
    const senderHandle = fromHandle ?? legacySender;
    if (!text || !senderHandle) return null;
    if (d.is_from_me === true) return null;
    return { text, senderHandle };
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: UnknownRecord;

  try {
    payload = (await request.json()) as UnknownRecord;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = getEventType(payload);
  if (eventType !== "message.received") {
    return NextResponse.json({ received: true });
  }

  const parsed = parseInboundMessage(payload);
  if (!parsed) {
    return NextResponse.json({ received: true });
  }

  const senderPhone = parsed.senderHandle;
  const messageText = parsed.text;

  // Resolve userId: prefer matching by owner env var, fall back to phone lookup
  const ownerUserId = process.env.LINQ_OWNER_USER_ID;

  let userId: string | null = ownerUserId ?? null;

  if (!userId && senderPhone) {
    // Attempt lookup — userProfiles doesn't have a phone column yet, so we use
    // the owner ID env var as the primary path. Extend here if phone is added.
    userId = null;
  }

  if (!userId) {
    console.warn("[linq/webhook] Could not resolve userId for sender", senderPhone);
    return NextResponse.json({ received: true });
  }

  // Fetch business name for the system prompt
  const [profile] = await db
    .select({ businessName: userProfiles.businessName })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);

  // Run the agent (non-blocking error handling so we always return 200)
  try {
    const reply = await runLinqAgent({
      userId,
      message: messageText,
      businessName: profile?.businessName ?? undefined,
    });

    const replyTo = senderPhone ?? process.env.LINQ_FROM_NUMBER;
    if (replyTo) {
      await sendImessage(replyTo, reply);
    }
  } catch (err) {
    console.error("[linq/webhook] Agent error:", err);
    // Attempt to send an error notice back
    try {
      const replyTo = senderPhone ?? process.env.LINQ_FROM_NUMBER;
      if (replyTo) {
        await sendImessage(replyTo, "Sorry, I hit an error processing that. Try again.");
      }
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ received: true });
}
