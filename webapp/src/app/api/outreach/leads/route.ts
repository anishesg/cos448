import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { outreachLeads, outreachCampaigns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const campaignId = request.nextUrl.searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json(
      { error: "campaignId required" },
      { status: 400 }
    );
  }

  const leads = await db
    .select()
    .from(outreachLeads)
    .where(eq(outreachLeads.campaignId, campaignId))
    .orderBy(desc(outreachLeads.createdAt));

  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { campaignId, leads: newLeads } = body;

  if (!campaignId || !Array.isArray(newLeads)) {
    return NextResponse.json(
      { error: "campaignId and leads array required" },
      { status: 400 }
    );
  }

  const inserted = [];
  for (const lead of newLeads) {
    const [row] = await db
      .insert(outreachLeads)
      .values({
        campaignId,
        name: lead.name,
        profileUrl: lead.profileUrl ?? null,
        platformUserId: lead.platformUserId ?? null,
        metadata: lead.metadata ?? null,
      })
      .returning();
    inserted.push(row);
  }

  return NextResponse.json({ leads: inserted });
}
