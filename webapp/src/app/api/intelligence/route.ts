import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { queryKnowledge } from "@/lib/intelligence/rag";
import { researchCompetitor, findOpportunities } from "@/lib/intelligence/web-researcher";
import { db } from "@/lib/db";
import { knowledgeSources, knowledgeChunks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const q = request.nextUrl.searchParams.get("q");

  if (q) {
    const results = await queryKnowledge(q, user.userId, 8);
    return NextResponse.json({ results });
  }

  // Return recent knowledge sources and chunks
  const sources = await db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.userId, user.userId))
    .orderBy(desc(knowledgeSources.createdAt))
    .limit(20);

  const recentChunks = await db
    .select({
      id: knowledgeChunks.id,
      sourceType: knowledgeChunks.sourceType,
      title: knowledgeChunks.title,
      content: knowledgeChunks.content,
      metadata: knowledgeChunks.metadata,
      createdAt: knowledgeChunks.createdAt,
    })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.userId, user.userId))
    .orderBy(desc(knowledgeChunks.createdAt))
    .limit(20);

  return NextResponse.json({ sources, chunks: recentChunks });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json();
  const { type, query, name, url, industry, keywords } = body;

  if (type === "competitor") {
    const result = await researchCompetitor({
      userId: user.userId,
      name: name ?? query,
      url,
    });
    return NextResponse.json(result);
  }

  if (type === "opportunity") {
    const result = await findOpportunities({
      userId: user.userId,
      industry: industry ?? "consulting",
      keywords: keywords ?? [query],
    });
    return NextResponse.json(result);
  }

  if (type === "search" && query) {
    const results = await queryKnowledge(query, user.userId, 8);
    return NextResponse.json({ results });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
