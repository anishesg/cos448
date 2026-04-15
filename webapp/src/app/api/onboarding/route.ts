import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfiles, trustRules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_TRUST_RULES = [
  { category: "scheduling", autonomyLevel: "auto_act" },
  { category: "follow_up", autonomyLevel: "auto_send" },
  { category: "lead_reply", autonomyLevel: "draft_only" },
  { category: "client_reply", autonomyLevel: "ask_every_time" },
  { category: "browser", autonomyLevel: "ask_every_time" },
  { category: "payment", autonomyLevel: "observe" },
  { category: "legal", autonomyLevel: "observe" },
];

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json();

  const {
    businessName,
    businessType,
    businessWebsite,
    timezone,
    answers,
  } = body;

  // Update user profile with onboarding data
  await db
    .update(userProfiles)
    .set({
      businessName,
      businessType,
      businessWebsite,
      timezone: timezone ?? "America/New_York",
      onboardingAnswers: answers ?? null,
    })
    .where(eq(userProfiles.id, user.userId));

  // Seed default trust rules
  const existingRules = await db
    .select()
    .from(trustRules)
    .where(eq(trustRules.userId, user.userId));

  if (existingRules.length === 0) {
    for (const rule of DEFAULT_TRUST_RULES) {
      await db.insert(trustRules).values({
        userId: user.userId,
        category: rule.category,
        autonomyLevel: rule.autonomyLevel,
      });
    }
  }

  return NextResponse.json({ success: true });
}
