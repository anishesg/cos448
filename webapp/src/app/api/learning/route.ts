import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { learnedPreferences } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { analyzeFounderBehavior } from "@/lib/agents/learning-agent";

export async function GET() {
  try {
    const user = await requireApiUser();

    const preferences = await db
      .select()
      .from(learnedPreferences)
      .where(eq(learnedPreferences.userId, user.userId))
      .orderBy(desc(learnedPreferences.createdAt));

    return NextResponse.json({ preferences });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Learning GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await requireApiUser();

    const newObservations = await analyzeFounderBehavior(user.userId);

    return NextResponse.json({
      analyzed: true,
      newObservations: newObservations.length,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Learning POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireApiUser();
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
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Learning PUT error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
