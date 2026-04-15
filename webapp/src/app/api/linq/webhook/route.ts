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

interface LinqWebhookMessage {
  id: string;
  chat_id: string;
  text: string;
  sender: { handle: string };
}

interface LinqWebhookPayload {
  event: string;
  data: { message: LinqWebhookMessage };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: LinqWebhookPayload;

  try {
    payload = (await request.json()) as LinqWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event !== "message.received") {
    return NextResponse.json({ received: true });
  }

  const message = payload.data?.message;
  if (!message?.text) {
    return NextResponse.json({ received: true });
  }

  const senderPhone = message.sender?.handle;
  const messageText = message.text.trim();

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
