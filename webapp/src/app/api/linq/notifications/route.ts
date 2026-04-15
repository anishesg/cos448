/**
 * GET /api/linq/notifications
 * Returns the in-memory notification log (last 10 entries).
 */

import { NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { getNotificationLog } from "@/lib/linq/notifications";

export async function GET(): Promise<NextResponse> {
  try {
    await requireApiUser();
    const all = getNotificationLog();
    return NextResponse.json({ notifications: all.slice(0, 10) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}
