import { db } from "@/lib/db";
import { knowledgeChunks, knowledgeSources } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";

export async function indexChunk(opts: {
  userId: string;
  sourceId?: string;
  sourceType: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const embedding = await generateEmbedding(opts.content);

  const [chunk] = await db
    .insert(knowledgeChunks)
    .values({
      userId: opts.userId,
      sourceId: opts.sourceId,
      sourceType: opts.sourceType,
      title: opts.title,
      content: opts.content,
      embedding,
      metadata: opts.metadata,
    })
    .returning({ id: knowledgeChunks.id });

  return chunk.id;
}

export async function indexChunks(
  chunks: Array<{
    userId: string;
    sourceId?: string;
    sourceType: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<number> {
  let indexed = 0;
  for (const chunk of chunks) {
    try {
      await indexChunk(chunk);
      indexed++;
    } catch (err) {
      console.error("Failed to index chunk:", err);
    }
  }
  return indexed;
}

export interface RAGResult {
  id: string;
  title: string | null;
  content: string;
  sourceType: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

export async function queryKnowledge(
  question: string,
  userId: string,
  topK: number = 5,
  sourceTypeFilter?: string
): Promise<RAGResult[]> {
  const queryEmbedding = await generateEmbedding(question);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const conditions = [
    sql`${knowledgeChunks.userId} = ${userId}`,
    sql`${knowledgeChunks.embedding} IS NOT NULL`,
  ];

  if (sourceTypeFilter) {
    conditions.push(sql`${knowledgeChunks.sourceType} = ${sourceTypeFilter}`);
  }

  const results = await db.execute(sql`
    SELECT
      id,
      title,
      content,
      source_type,
      metadata,
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM knowledge_chunks
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  return (results as unknown as Array<{
    id: string;
    title: string | null;
    content: string;
    source_type: string;
    similarity: number;
    metadata: Record<string, unknown> | null;
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    sourceType: row.source_type,
    similarity: row.similarity,
    metadata: row.metadata,
  }));
}

export async function createSource(opts: {
  userId: string;
  sourceType: string;
  sourceUrl?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const [source] = await db
    .insert(knowledgeSources)
    .values({
      userId: opts.userId,
      sourceType: opts.sourceType,
      sourceUrl: opts.sourceUrl,
      title: opts.title,
      status: "active",
      lastScrapedAt: new Date(),
      metadata: opts.metadata,
    })
    .returning({ id: knowledgeSources.id });

  return source.id;
}
