import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";
import { indexChunk, createSource } from "./rag";
import { tavilySearch } from "./tavily";
import { db } from "@/lib/db";
import {
  knowledgeChunks,
  contactResearch,
  contacts,
} from "@/lib/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { researchContact } from "./web-researcher";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const RESEARCH_TOPICS = [
  "college admissions 2025 2026 acceptance rate changes",
  "ivy league early decision acceptance rates 2026",
  "SAT ACT changes 2025 2026",
  "college application essay prompts 2026",
  "scholarship opportunities high school seniors 2026",
  "college admissions trends news",
  "common app changes 2025",
] as const;

const MAX_SEARCHES_PER_CYCLE = 3;
const SEARCH_DELAY_MS = 2000;
const FRESHNESS_WINDOW_HOURS = 24;
const CONTACT_RESEARCH_STALENESS_DAYS = 7;
const TOP_CONTACTS_TO_ENRICH = 3;

/** Returns true when a chunk for this topic already exists in the last 24 hours. */
async function hasRecentChunk(
  userId: string,
  topic: string
): Promise<boolean> {
  const cutoff = new Date(
    Date.now() - FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000
  );

  const rows = await db
    .select({ id: knowledgeChunks.id })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.userId, userId),
        eq(knowledgeChunks.sourceType, "research_cycle"),
        gte(knowledgeChunks.createdAt, cutoff),
        sql`${knowledgeChunks.metadata}->>'topic' = ${topic}`
      )
    )
    .limit(1);

  return rows.length > 0;
}

async function synthesizeTopic(
  topic: string,
  rawResults: Array<{ title: string; url: string; content: string }>
): Promise<string> {
  if (!rawResults.length) return "No results found.";

  const context = rawResults
    .map((r) => `Source: ${r.title} (${r.url})\n${r.content}`)
    .join("\n\n---\n\n");

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.HAIKU_4_5,
      system: [
        {
          text: `You are a research analyst for a college admissions consulting business. Synthesize the following web results into a concise, actionable summary. Focus on facts, statistics, and trends that would help a college admissions consultant advise families and high school students. Highlight any significant changes or deadlines. Be factual and specific.`,
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Research topic: ${topic}\n\nWeb results:\n${context}\n\nProvide a concise, actionable summary (2-4 paragraphs).`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 800 },
    })
  );

  const textBlock = response.output?.message?.content?.find(
    (b) => "text" in b
  );
  return textBlock && "text" in textBlock ? (textBlock.text ?? "") : "";
}

export interface ResearchCycleSummary {
  topicsResearched: number;
  chunksAdded: number;
  contactsEnriched: number;
}

/**
 * Runs one research cycle:
 * 1. Searches up to MAX_SEARCHES_PER_CYCLE topics (rotating through the list).
 * 2. Skips topics that already have a fresh chunk (< 24 h old).
 * 3. Synthesizes results with Haiku and stores them as knowledge chunks.
 * 4. Enriches up to TOP_CONTACTS_TO_ENRICH stale contacts.
 *
 * The userId is the system/admin user whose knowledge base will be updated.
 * Pass the user ID from the calling context (cron or API route).
 */
export async function runResearchCycle(
  userId: string
): Promise<ResearchCycleSummary> {
  let topicsResearched = 0;
  let chunksAdded = 0;
  let contactsEnriched = 0;

  // ── 1. Topic research ────────────────────────────────────────────────────

  // Determine which topics still need to be searched
  const topicsToProcess: string[] = [];
  for (const topic of RESEARCH_TOPICS) {
    if (topicsToProcess.length >= MAX_SEARCHES_PER_CYCLE) break;
    const fresh = await hasRecentChunk(userId, topic);
    if (!fresh) {
      topicsToProcess.push(topic);
    }
  }

  for (const topic of topicsToProcess) {
    try {
      const results = await tavilySearch(topic, {
        maxResults: 5,
        searchDepth: "basic",
      });

      if (results.length === 0) {
        // Still count as searched; just nothing to store
        topicsResearched++;
        await new Promise((r) => setTimeout(r, SEARCH_DELAY_MS));
        continue;
      }

      const summary = await synthesizeTopic(topic, results);

      if (summary && summary !== "No results found.") {
        const sourceId = await createSource({
          userId,
          sourceType: "research_cycle",
          title: `Research Cycle: ${topic}`,
          metadata: {
            topic,
            cycle_date: new Date().toISOString(),
          },
        });

        await indexChunk({
          userId,
          sourceId,
          sourceType: "research_cycle",
          title: topic,
          content: summary,
          metadata: {
            topic,
            cycle_date: new Date().toISOString(),
            freshness_score: 1.0,
            sources: results.map((r) => ({ title: r.title, url: r.url })),
          },
        });

        chunksAdded++;
      }

      topicsResearched++;
    } catch (err) {
      console.error(`Research cycle error for topic "${topic}":`, err);
    }

    // Rate limit between searches
    await new Promise((r) => setTimeout(r, SEARCH_DELAY_MS));
  }

  // ── 2. Contact enrichment ────────────────────────────────────────────────

  const staleCutoff = new Date(
    Date.now() - CONTACT_RESEARCH_STALENESS_DAYS * 24 * 60 * 60 * 1000
  );

  // Find contacts with no research in the last 7 days, ranked by fitScore desc
  // We do a LEFT JOIN via a subquery approach using drizzle raw sql
  const staleContacts = await db.execute(sql`
    SELECT c.id, c.name, c.email, c.company, c.fit_score
    FROM contacts c
    WHERE c.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM contact_research cr
        WHERE cr.contact_id = c.id
          AND cr.created_at >= ${staleCutoff}
      )
    ORDER BY c.fit_score DESC NULLS LAST
    LIMIT ${TOP_CONTACTS_TO_ENRICH}
  `);

  const rows = staleContacts as unknown as Array<{
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    fit_score: number | null;
  }>;

  for (const row of rows) {
    try {
      await researchContact({
        userId,
        contactId: row.id,
        name: row.name,
        email: row.email,
        company: row.company,
      });
      contactsEnriched++;
    } catch (err) {
      console.error(`Failed to enrich contact ${row.id}:`, err);
    }
  }

  return { topicsResearched, chunksAdded, contactsEnriched };
}

/** Returns the most recent research cycle chunks for a user (for display). */
export async function getRecentResearchChunks(
  userId: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    title: string | null;
    content: string;
    metadata: Record<string, unknown> | null;
    createdAt: Date | null;
  }>
> {
  const rows = await db
    .select({
      id: knowledgeChunks.id,
      title: knowledgeChunks.title,
      content: knowledgeChunks.content,
      metadata: knowledgeChunks.metadata,
      createdAt: knowledgeChunks.createdAt,
    })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.userId, userId),
        eq(knowledgeChunks.sourceType, "research_cycle")
      )
    )
    .orderBy(desc(knowledgeChunks.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
  }));
}
