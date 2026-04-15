import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { outreachCampaigns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const user = await requireApiUser();

    const campaigns = await db
      .select()
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.userId, user.userId))
      .orderBy(desc(outreachCampaigns.createdAt));

    return NextResponse.json({ campaigns });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Outreach campaigns GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
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
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Outreach campaigns POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireApiUser();
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
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Outreach campaigns PUT error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
