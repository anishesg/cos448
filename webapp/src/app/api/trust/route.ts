import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { trustRules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_TRUST_RULES = [
  { category: "scheduling", autonomyLevel: "auto_act", conditions: { withinBusinessHours: true } },
  { category: "follow_up", autonomyLevel: "auto_send", conditions: { maxAttempts: 3 } },
  { category: "lead_reply", autonomyLevel: "draft_only", conditions: {} },
  { category: "client_reply", autonomyLevel: "ask_every_time", conditions: {} },
  { category: "browser", autonomyLevel: "ask_every_time", conditions: {} },
  { category: "payment", autonomyLevel: "observe", conditions: {} },
  { category: "legal", autonomyLevel: "observe", conditions: {} },
];

export async function GET() {
  const user = await requireUser();

  let rules = await db
    .select()
    .from(trustRules)
    .where(eq(trustRules.userId, user.userId));

  // Seed defaults if none exist
  if (rules.length === 0) {
    for (const rule of DEFAULT_TRUST_RULES) {
      await db.insert(trustRules).values({
        userId: user.userId,
        ...rule,
      });
    }
    rules = await db
      .select()
      .from(trustRules)
      .where(eq(trustRules.userId, user.userId));
  }

  return NextResponse.json({ rules });
}

export async function PUT(request: NextRequest) {
  const user = await requireUser();
  const { category, autonomyLevel, conditions } = await request.json();

  if (!category || !autonomyLevel) {
    return NextResponse.json(
      { error: "category and autonomyLevel required" },
      { status: 400 }
    );
  }

  // Upsert
  const existing = await db
    .select()
    .from(trustRules)
    .where(
      eq(trustRules.userId, user.userId)
    );

  const existingRule = existing.find((r) => r.category === category);

  if (existingRule) {
    await db
      .update(trustRules)
      .set({ autonomyLevel, conditions: conditions ?? null, updatedAt: new Date() })
      .where(eq(trustRules.id, existingRule.id));
  } else {
    await db.insert(trustRules).values({
      userId: user.userId,
      category,
      autonomyLevel,
      conditions: conditions ?? null,
    });
  }

  return NextResponse.json({ success: true });
}
