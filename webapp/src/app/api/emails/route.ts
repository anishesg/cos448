import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailThreads } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

  const threads = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.userId, user.userId))
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ threads });
}
