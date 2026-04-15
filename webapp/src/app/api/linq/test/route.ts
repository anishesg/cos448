/**
 * POST /api/linq/test
 * Sends a test iMessage to the configured owner phone number.
 */

import { NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { sendTestNotification } from "@/lib/linq/notifications";

export async function POST(): Promise<NextResponse> {
  try {
    await requireApiUser();

    if (!process.env.LINQ_API_TOKEN) {
      return NextResponse.json({ error: "LINQ_API_TOKEN is not set" }, { status: 400 });
    }
    if (!process.env.LINQ_FROM_NUMBER) {
      return NextResponse.json({ error: "LINQ_FROM_NUMBER is not set" }, { status: 400 });
    }
    if (!process.env.LINQ_OWNER_PHONE) {
      return NextResponse.json({ error: "LINQ_OWNER_PHONE is not set" }, { status: 400 });
    }

    await sendTestNotification();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Test failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
