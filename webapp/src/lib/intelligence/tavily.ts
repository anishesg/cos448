const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function tavilySearch(
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
