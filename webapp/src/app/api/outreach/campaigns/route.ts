import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { outreachCampaigns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const user = await requireUser();

  const campaigns = await db
    .select()
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.userId, user.userId))
    .orderBy(desc(outreachCampaigns.createdAt));

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json();

  const [campaign] = await db
    .insert(outreachCampaigns)
    .values({
      userId: user.userId,
      channel: body.channel ?? "email",
      campaignName: body.name ?? "Untitled Campaign",
      targetCriteria: body.targetCriteria ?? null,
      messageTemplate: body.messageTemplate ?? null,
      status: "draft",
      stats: { sent: 0, opened: 0, replied: 0, converted: 0 },
    })
    .returning();

  return NextResponse.json({ campaign });
}

export async function PUT(request: NextRequest) {
  const user = await requireUser();
  const { campaignId, ...updates } = await request.json();

  if (!campaignId) {
    return NextResponse.json(
      { error: "campaignId required" },
      { status: 400 }
    );
  }

  await db
    .update(outreachCampaigns)
    .set(updates)
    .where(eq(outreachCampaigns.id, campaignId));

  return NextResponse.json({ success: true });
}
