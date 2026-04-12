import { config } from "../config.js";
import { getDb, insertKeyword, incrementBudget, getKeywordSearchStats } from "../db.js";

/**
 * LLM-powered keyword generator for discovering new Facebook groups.
 * Analyzes top-performing groups to suggest relevant search terms.
 */

const KEYWORD_GEN_MODEL = "us.anthropic.claude-sonnet-4-6"; // Sonnet for strategic thinking

// Tool spec for structured keyword output (group discovery + in-group search)
const keywordTool = {
  name: "generate_keywords",
  description: "Generate keywords for group discovery and in-group post search",
  inputSchema: {
    json: {
      type: "object",
      properties: {
        discovery_keywords: {
          type: "array",
          items: { type: "string" },
          description: "5-10 multi-word search queries for finding new Facebook groups (e.g. 'bay area parents college prep')",
        },
        search_keywords: {
          type: "array",
          items: { type: "string" },
          description: "5-10 short 1-2 word terms to search WITHIN groups for relevant posts (e.g. 'SAT', 'research', 'essay')",
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of the keyword strategy",
        },
      },
      required: ["discovery_keywords", "search_keywords", "reasoning"],
      additionalProperties: false,
    },
  },
};

/**
 * Get top-performing groups for keyword generation
 */
function getTopGroups() {
  const db = getDb();

  // Top 5 all-time best groups (by total leads found)
  const allTimeBest = db.prepare(`
    SELECT * FROM fb_groups
    WHERE status = 'ACTIVE' AND total_leads_found > 0
    ORDER BY total_leads_found DESC, lead_yield_rate DESC
    LIMIT 5
  `).all();

  // Top 3 recent performers (scraped in last 7 days, high yield)
  const recentBest = db.prepare(`
    SELECT * FROM fb_groups
    WHERE status = 'ACTIVE'
      AND last_scraped_at >= datetime('now', '-7 days')
      AND total_comments_scanned >= 20
    ORDER BY lead_yield_rate DESC, total_leads_found DESC
    LIMIT 3
  `).all();

  // Get sample successful comments from these groups
  const topGroupIds = [...new Set([
    ...allTimeBest.map(g => g.id),
    ...recentBest.map(g => g.id)
  ])];

  let sampleComments = [];
  if (topGroupIds.length > 0) {
    const placeholders = topGroupIds.map(() => '?').join(',');
    sampleComments = db.prepare(`
      SELECT source_comment_text, classification_reason, source_group_id
      FROM fb_leads
      WHERE source_group_id IN (${placeholders})
        AND classification_confidence >= 0.8
      ORDER BY created_at DESC
      LIMIT 10
    `).all(...topGroupIds);
  }

  return {  allTimeBest, recentBest, sampleComments };
}

/**
 * Generate new search keywords using LLM analysis of top groups
 */
export async function generateKeywords() {
  console.log("\n🧠 Generating new keywords with LLM...");

  const { allTimeBest, recentBest, sampleComments } = getTopGroups();

  if (allTimeBest.length === 0 && recentBest.length === 0) {
    console.log("  ⚠ No successful groups yet, using seed keywords");
    return config.fbFinder.seedSearchTerms.slice(0, 7);
  }

  // Build context for LLM
  const allTimeSummary = allTimeBest.map((g, i) =>
    `${i + 1}. "${g.group_name || g.group_url}" - ${g.total_leads_found} leads from ${g.total_comments_scanned} comments (${(g.lead_yield_rate * 100).toFixed(1)}% yield)`
  ).join("\n");

  const recentSummary = recentBest.map((g, i) =>
    `${i + 1}. "${g.group_name || g.group_url}" - ${g.total_leads_found} leads (${(g.lead_yield_rate * 100).toFixed(1)}% yield, scraped recently)`
  ).join("\n");

  const commentExamples = sampleComments.slice(0, 5).map((c, i) =>
    `${i + 1}. "${c.source_comment_text?.slice(0, 150)}..." → Classified as lead: ${c.classification_reason?.slice(0, 80)}`
  ).join("\n");

  // Get in-group search keyword performance
  let searchKeywordStats = [];
  try {
    searchKeywordStats = getKeywordSearchStats();
  } catch {
    // Table may not exist yet
  }

  const searchKwSummary = searchKeywordStats.slice(0, 10).map((k) =>
    `"${k.keyword}" — ${k.total_leads} leads from ${k.total_posts} posts (${k.search_count} searches)`
  ).join("\n");

  const systemPrompt = `You are a Facebook group discovery strategist for a college admissions consulting service.

TARGET AUDIENCE: Parents of high school or middle school students who need help with:
- College admissions process
- SAT/ACT prep
- Extracurriculars and research programs
- Essays and application strategy
- Course selection and GPA optimization

You generate TWO types of keywords:
1. DISCOVERY keywords: Multi-word queries to find new Facebook groups (e.g. "bay area parents college prep")
2. SEARCH keywords: Short 1-2 word terms to search WITHIN groups for relevant posts (e.g. "SAT", "research", "essay")`;

  const userPrompt = `Here are our most successful Facebook groups for finding college consulting leads:

TOP 5 ALL-TIME BEST GROUPS:
${allTimeSummary || "None yet"}

TOP 3 RECENT PERFORMERS:
${recentSummary || "None yet"}

SAMPLE COMMENTS THAT BECAME LEADS:
${commentExamples || "None yet"}

IN-GROUP SEARCH KEYWORD PERFORMANCE (keywords we search within groups):
${searchKwSummary || "No data yet"}

CURRENT GROUP-DISCOVERY KEYWORDS (for reference, don't repeat these exactly):
${config.fbFinder.seedSearchTerms.join(", ")}

Generate TWO sets of keywords:

1. DISCOVERY KEYWORDS (7-10): Multi-word queries to find NEW Facebook groups
   - Target parents (not students)
   - Include geographic variations (Bay Area, Silicon Valley, specific cities)
   - Include demographic variations (Indian parents, Asian parents, immigrant parents, tech parents)
   - Include topic variations (gifted education, STEM programs, competitive colleges)

2. SEARCH KEYWORDS (5-10): Short 1-2 word terms to search WITHIN groups for relevant posts
   - These should be specific enough to surface posts from parents needing help
   - Think about what words a struggling parent would use in their post
   - Single words or short phrases: "SAT", "application", "recommendation", "stressed", "deadline"
   - Look at the in-group search keyword performance above and generate DIFFERENT keywords
   - Avoid generic terms that every post contains`;

  const token = config.bedrock.bearerToken;
  const region = config.bedrock.region;
  const modelId = KEYWORD_GEN_MODEL;
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;

  const payload = {
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userPrompt }] }],
    inferenceConfig: {
      maxTokens: 1024,
      temperature: 0.8, // Higher temp for creative keyword generation
    },
    toolConfig: {
      tools: [{ toolSpec: keywordTool }],
      toolChoice: { tool: { name: "generate_keywords" } },
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bedrock keyword generation error (${response.status}): ${text}`);
  }

  const data = await response.json();

  // Track token usage
  const usage = data.usage || {};
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  // Sonnet 4.6 pricing: $3/M in, $15/M out
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  incrementBudget({ inputTokens, outputTokens, costUsd });

  // Extract tool use result
  const toolUseBlock = data.output?.message?.content?.find((block) => block.toolUse);

  if (toolUseBlock?.toolUse?.input) {
    const { discovery_keywords, search_keywords, keywords, reasoning } = toolUseBlock.toolUse?.input;

    // Handle both new format (discovery_keywords + search_keywords) and old format (keywords)
    const discoveryKws = discovery_keywords || keywords || [];
    const searchKws = search_keywords || [];

    console.log(`  ✓ Generated ${discoveryKws.length} discovery keywords, ${searchKws.length} search keywords`);
    console.log(`  Strategy: ${reasoning?.slice(0, 150)}...`);
    console.log(`  Cost: $${costUsd.toFixed(4)}`);

    // Store group-discovery keywords
    for (const kw of discoveryKws) {
      insertKeyword({ keyword: kw, generatedBy: 'autopilot-llm' });
    }

    // Store in-group search keywords
    const db = getDb();
    for (const kw of searchKws) {
      db.prepare(`
        INSERT OR IGNORE INTO fb_search_keywords (keyword, source, status)
        VALUES (?, 'llm', 'ACTIVE')
      `).run(kw);
    }

    return { discoveryKeywords: discoveryKws, searchKeywords: searchKws };
  }

  throw new Error("No keywords returned from LLM");
}

/**
 * Get mixed keyword strategy: seed keywords + LLM-generated + top historical
 */
export function getMixedKeywords() {
  const db = getDb();

  // Get historical keywords that found groups with leads
  const historicalGood = db.prepare(`
    SELECT DISTINCT g.search_keywords
    FROM fb_groups g
    WHERE g.search_keywords IS NOT NULL
      AND g.total_leads_found > 0
    ORDER BY g.total_leads_found DESC
    LIMIT 5
  `).all().map(r => r.search_keywords).filter(Boolean);

  // Get recent LLM-generated keywords
  const llmKeywords = db.prepare(`
    SELECT keyword FROM autopilot_keywords
    WHERE generated_by = 'autopilot-llm'
      AND status = 'ACTIVE'
    ORDER BY generated_at DESC
    LIMIT 10
  `).all().map(r => r.keyword);

  // Combine: seed + LLM + historical, deduplicated
  const combined = [
    ...config.fbFinder.seedSearchTerms.slice(0, 3),
    ...llmKeywords,
    ...historicalGood,
  ];

  return [...new Set(combined)].slice(0, 15);
}
