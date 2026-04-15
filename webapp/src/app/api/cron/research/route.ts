import { NextRequest, NextResponse } from "next/server";
import { runResearchCycle } from "@/lib/intelligence/research-runner";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";

/**
 * GET /api/cron/research
 *
 * Called by Vercel Cron (or any external cron service).
 * Runs one research cycle for all active users (or just the first user
 * in single-tenant mode).
 *
 * Add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/research", "schedule": "0 6 * * *" }] }
 */
export async function GET(request: NextRequest) {
  // Verify cron secret when provided (Vercel sets CRON_SECRET automatically)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // In single-tenant / small-team mode run the cycle for every user.
    // Limit to 10 users to avoid runaway execution time.
    const users = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .limit(10);

    const results: Array<{
      userId: string;
      topicsResearched: number;
      chunksAdded: number;
      contactsEnriched: number;
    }> = [];

    for (const user of users) {
      try {
        const summary = await runResearchCycle(user.id);
        results.push({ userId: user.id, ...summary });
      } catch (err) {
        console.error(`Research cycle failed for user ${user.id}:`, err);
        results.push({
          userId: user.id,
          topicsResearched: 0,
          chunksAdded: 0,
          contactsEnriched: 0,
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("Cron research route error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
