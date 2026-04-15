import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { learnedPreferences } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { analyzeFounderBehavior } from "@/lib/agents/learning-agent";

export async function GET() {
  const user = await requireUser();

  const preferences = await db
    .select()
    .from(learnedPreferences)
    .where(eq(learnedPreferences.userId, user.userId))
    .orderBy(desc(learnedPreferences.createdAt));

  return NextResponse.json({ preferences });
}

export async function POST() {
  const user = await requireUser();

  const newObservations = await analyzeFounderBehavior(user.userId);

  return NextResponse.json({
    analyzed: true,
    newObservations: newObservations.length,
  });
}

export async function PUT(request: NextRequest) {
  const user = await requireUser();
  const { preferenceId, action } = await request.json();

  if (!preferenceId || !action) {
    return NextResponse.json(
      { error: "preferenceId and action required" },
      { status: 400 }
    );
  }

  const statusMap: Record<string, string> = {
    confirm: "confirmed",
    reject: "rejected",
    auto_apply: "auto_applied",
  };

  const newStatus = statusMap[action];
  if (!newStatus) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await db
    .update(learnedPreferences)
    .set({ status: newStatus })
    .where(eq(learnedPreferences.id, preferenceId));

  return NextResponse.json({ success: true });
}
