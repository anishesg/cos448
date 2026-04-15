import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { queryKnowledge } from "@/lib/intelligence/rag";
import { researchCompetitor, findOpportunities } from "@/lib/intelligence/web-researcher";
import { db } from "@/lib/db";
import { knowledgeSources, knowledgeChunks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const q = request.nextUrl.searchParams.get("q");

    if (q) {
      const results = await queryKnowledge(q, user.userId, 8);
      return NextResponse.json({ results });
    }

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
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Intelligence GET error:", error);
    return NextResponse.json({ error: "Failed to fetch intelligence" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

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

    return NextResponse.json({ error: "Invalid type. Use: search, competitor, or opportunity" }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Intelligence POST error:", error);
    return NextResponse.json({ error: "Intelligence query failed" }, { status: 500 });
  }
}
