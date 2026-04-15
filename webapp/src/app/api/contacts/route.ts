import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "200");
    const rawOffset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 200 : rawLimit, 1), 500);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    const allContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, user.userId))
      .orderBy(desc(contacts.lastContactAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ contacts: allContacts });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch contacts:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}
