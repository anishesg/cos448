import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";
import { indexChunk, createSource } from "./rag";
import { db } from "@/lib/db";
import { contactResearch } from "@/lib/db/schema";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

async function tavilySearch(
  query: string,
  opts?: { maxResults?: number; searchDepth?: "basic" | "advanced" }
): Promise<TavilyResult[]> {
  if (!TAVILY_API_KEY) {
    console.warn("TAVILY_API_KEY not set, skipping web search");
    return [];
  }

  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: opts?.maxResults ?? 5,
        search_depth: opts?.searchDepth ?? "basic",
        include_answer: false,
      }),
    });

    if (!res.ok) {
      console.error("Tavily search failed:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return (data.results ?? []) as TavilyResult[];
  } catch (err) {
    console.error("Tavily search error:", err);
    return [];
  }
}

async function synthesizeResearch(
  query: string,
  results: TavilyResult[]
): Promise<string> {
  if (!results.length) return "No web results found.";

  const context = results
    .map((r) => `Source: ${r.title} (${r.url})\n${r.content}`)
    .join("\n\n---\n\n");

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.SONNET_4_6,
      system: [{
        text: "You are a research analyst. Synthesize the web search results into a clear, actionable summary. Focus on facts that would be useful for a business relationship. Be concise.",
      }],
      messages: [{
        role: "user",
        content: [{
          text: `Research query: ${query}\n\nWeb results:\n${context}\n\nProvide a concise, useful summary.`,
        }],
      }],
      inferenceConfig: { maxTokens: 1024 },
    })
  );

  const textBlock = response.output?.message?.content?.find(
    (b) => "text" in b
  );
  return textBlock && "text" in textBlock ? textBlock.text ?? "" : "";
}

export async function researchContact(opts: {
  userId: string;
  contactId: string;
  name: string | null;
  email: string;
  company?: string | null;
  emailContext?: string;
}): Promise<{ summary: string; sources: TavilyResult[] }> {
  const queries: string[] = [];

  if (opts.name && opts.company) {
    queries.push(`${opts.name} ${opts.company}`);
    queries.push(`${opts.name} LinkedIn`);
  } else if (opts.name) {
    queries.push(`${opts.name} ${opts.email.split("@")[1]}`);
    queries.push(`"${opts.name}" LinkedIn OR Facebook OR Twitter`);
  }

  const domain = opts.email.split("@")[1];
  if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(domain)) {
    queries.push(`${domain} company about`);
  }

  if (opts.name) {
    queries.push(`"${opts.name}" education OR career OR interests`);
  }

  const allResults: TavilyResult[] = [];
  for (const q of queries) {
    const results = await tavilySearch(q, { maxResults: 4, searchDepth: "advanced" });
    allResults.push(...results);
    await new Promise((r) => setTimeout(r, 500));
  }

  const context = allResults
    .map((r) => `Source: ${r.title} (${r.url})\n${r.content}`)
    .join("\n\n---\n\n");

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.SONNET_4_6,
      system: [
        {
          text: `You are an elite sales intelligence analyst for a consulting business. Build a comprehensive customer persona from web research and email context. Your output helps the business owner know exactly how to approach, engage, and convert this person into a paying client.

Structure your analysis as:

## [Person's Name] — Customer Persona

### Who They Are
- Role, background, education, career highlights
- Location, age range if determinable
- Social media presence / public visibility

### What They Care About
- Personal interests, values, goals
- Pain points and anxieties (especially related to our services)
- Decision-making style (analytical, emotional, delegator, etc.)

### How to Sell to Them
- Recommended approach and tone
- What messaging will resonate
- Potential objections and how to handle them
- Price sensitivity assessment
- Timeline urgency

### Conversation Starters
- 3-5 specific, personalized talking points based on their background
- References to their interests/achievements that build rapport

### Risk Assessment
- Likelihood to convert (high/medium/low)
- Potential deal value
- Red flags to watch for

Be specific. Use real details from the research. If limited info is found, note it and work with what's available from the email context.`,
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Build a customer persona for this contact:
Name: ${opts.name ?? "Unknown"}
Email: ${opts.email}
Company: ${opts.company ?? "Unknown"}
${opts.emailContext ? `\nEmail context (what they've discussed):\n${opts.emailContext}` : ""}

Web research results:
${context || "No web results found."}`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 2048 },
    })
  );

  const textBlock = response.output?.message?.content?.find(
    (b) => "text" in b
  );
  const summary =
    textBlock && "text" in textBlock ? textBlock.text ?? "" : "";

  await db.insert(contactResearch).values({
    contactId: opts.contactId,
    userId: opts.userId,
    researchType: "contact_profile",
    summary,
    rawData: allResults as unknown as Record<string, unknown>,
    sources: allResults.map((r) => ({
      title: r.title,
      url: r.url,
    })) as unknown as Record<string, unknown>,
  });

  if (summary && summary !== "No web results found.") {
    const sourceId = await createSource({
      userId: opts.userId,
      sourceType: "contact_research",
      title: `Research: ${opts.name ?? opts.email}`,
      metadata: { contactId: opts.contactId, email: opts.email },
    });

    await indexChunk({
      userId: opts.userId,
      sourceId,
      sourceType: "contact_research",
      title: `About ${opts.name ?? opts.email}`,
      content: summary,
      metadata: { contactId: opts.contactId },
    });
  }

  return { summary, sources: allResults };
}

export async function researchCompetitor(opts: {
  userId: string;
  name: string;
  url?: string;
}): Promise<{ summary: string; sources: TavilyResult[] }> {
  const queries = [
    `${opts.name} services pricing reviews`,
    opts.url ? `site:${opts.url}` : `${opts.name} company`,
  ];

  const allResults: TavilyResult[] = [];
  for (const q of queries) {
    const results = await tavilySearch(q, { maxResults: 5, searchDepth: "advanced" });
    allResults.push(...results);
  }

  const summary = await synthesizeResearch(
    `Analyze ${opts.name} as a competitor. What services do they offer? Pricing? Strengths/weaknesses?`,
    allResults
  );

  if (summary) {
    const sourceId = await createSource({
      userId: opts.userId,
      sourceType: "competitor",
      sourceUrl: opts.url,
      title: `Competitor: ${opts.name}`,
    });

    await indexChunk({
      userId: opts.userId,
      sourceId,
      sourceType: "competitor",
      title: `Competitor Analysis: ${opts.name}`,
      content: summary,
    });
  }

  return { summary, sources: allResults };
}

export async function findOpportunities(opts: {
  userId: string;
  industry: string;
  keywords: string[];
}): Promise<{ summary: string; sources: TavilyResult[] }> {
  const query = `${opts.industry} ${opts.keywords.join(" ")} opportunities new programs trends 2026`;
  const results = await tavilySearch(query, { maxResults: 8, searchDepth: "advanced" });

  const summary = await synthesizeResearch(
    `Find business opportunities in ${opts.industry} related to: ${opts.keywords.join(", ")}`,
    results
  );

  if (summary) {
    const sourceId = await createSource({
      userId: opts.userId,
      sourceType: "opportunity",
      title: `Opportunities: ${opts.industry}`,
    });

    await indexChunk({
      userId: opts.userId,
      sourceId,
      sourceType: "opportunity",
      title: `Industry Opportunities: ${opts.industry}`,
      content: summary,
    });
  }

  return { summary, sources: results };
}
