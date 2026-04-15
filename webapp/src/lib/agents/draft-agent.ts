import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";
import { tavilySearch } from "@/lib/intelligence/tavily";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

interface DraftContext {
  threadSubject: string;
  threadSnippet: string;
  messageHistory: Array<{
    direction: string;
    senderName: string | null;
    bodySummary: string | null;
    bodyFull?: string | null;
    sentAt: string | null;
  }>;
  classification: {
    businessCategory?: string;
    urgency?: string;
    agentObjective?: string;
    summary?: string;
    recommendedAction?: string;
  } | null;
  businessType?: string;
  businessContext?: string;
  founderName?: string;
}

function buildSystemPrompt(ctx: DraftContext): string {
  return `You are writing emails on behalf of a solo ${ctx.businessType ?? "service"} business owner${ctx.founderName ? ` named ${ctx.founderName}` : ""}. Your job is to write replies that sound like a smart, busy professional — not a chatbot.

## Voice and style

Write like a real person, not a writing assistant. Short sentences. Direct. Conversational American English. Get to the point in the first sentence.

Match the energy of the thread. If they wrote 2 sentences, write 2-3 back. If they wrote a paragraph, a short paragraph is fine. Never write more than necessary.

## Hard rules — never do these

BANNED phrases (never use, ever):
- "I hope this finds you well" or any variant
- "I wanted to reach out"
- "I wanted to follow up"
- "Please don't hesitate to reach out / contact me / let me know"
- "Certainly!", "Absolutely!", "Great question!", "Of course!"
- "Best regards" or "Kind regards" unless the other person used it first in this thread
- Em dashes (—) — use a comma, period, or rewrite the sentence instead
- "I am writing to..." or "I'm reaching out because..."
- "I hope you're doing well" or "Hope you're having a great week"
- Filler openers that don't say anything

BANNED structure:
- Bullet points or numbered lists unless you're literally listing choices or steps they asked for
- Walls of text — max 3-4 sentences per paragraph
- Repeating what they said back to them before answering

## Good vs bad examples

BAD: "I hope this message finds you well! I wanted to reach out regarding your inquiry about our college counseling services — we'd love to connect and discuss how we can help."
GOOD: "Thanks for reaching out. Happy to walk you through what we do — are you free for a quick call this week?"

BAD: "Certainly! That's a great question about the college application timeline. I wanted to follow up on this because it's important to start early."
GOOD: "For juniors, the sweet spot to start is spring of junior year. That gives us time to build a real college list before summer."

BAD: "Please don't hesitate to reach out if you have any additional questions or concerns."
GOOD: "Let me know if you have questions." (or just end the email — it's fine)

BAD opener: "I hope you're having a wonderful week! I'm writing to follow up on our last conversation..."
GOOD opener: Just answer the question or continue the thread directly.

## Leads

If this is a potential client, move toward a natural next step without being pushy. Ask one clear question or suggest a call. Don't oversell. Let the work speak for itself.

## Client issues

If something went wrong or they're frustrated, acknowledge it in one sentence and get straight to the solution. Don't over-apologize.

## Sign-off

Use "Thanks," or match whatever sign-off style they used. Never use "Best regards" or "Kind regards" unless they did first.

## Format

Write ONLY the email body. No subject line. No "[Your name]" placeholder — the sender name will be added automatically.
${ctx.classification?.agentObjective ? `\nObjective: ${ctx.classification.agentObjective.replace(/_/g, " ")}` : ""}
${ctx.businessContext ? `\nBusiness context: ${ctx.businessContext}` : ""}`;
}

function buildHistoryStr(ctx: DraftContext): string {
  return ctx.messageHistory
    .map((m) => {
      // Prefer bodyFull over bodySummary — summaries lose tone and nuance
      const body = m.bodyFull ?? m.bodySummary ?? "(no content)";
      return `[${m.direction}${m.senderName ? ` from ${m.senderName}` : ""}${m.sentAt ? ` at ${m.sentAt}` : ""}]: ${body}`;
    })
    .join("\n");
}

function buildUserMessage(ctx: DraftContext, historyStr: string, extraContext?: string): string {
  return `Thread subject: ${ctx.threadSubject}
Thread summary: ${ctx.threadSnippet}

Message history:
${historyStr}

${ctx.classification?.summary ? `AI analysis: ${ctx.classification.summary}` : ""}
${extraContext ? `\nAdditional context from web search:\n${extraContext}` : ""}

Write a reply to the most recent inbound message.`;
}

export async function generateDraftStream(ctx: DraftContext) {
  const historyStr = buildHistoryStr(ctx);
  const systemPrompt = buildSystemPrompt(ctx);
  const userMessage = buildUserMessage(ctx, historyStr);

  const response = await bedrock.send(
    new ConverseStreamCommand({
      modelId: MODELS.SONNET_4_6,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 1024 },
    })
  );

  return response.stream;
}

// Tool definition for web search
const webSearchTool = {
  toolSpec: {
    name: "web_search",
    description:
      "Search the web for up-to-date information needed to write an accurate, helpful email reply. Use this when the person asks about specific facts, deadlines, admission rates, scholarships, or anything that requires current data.",
    inputSchema: {
      json: {
        type: "object" as const,
        properties: {
          query: {
            type: "string" as const,
            description: "The search query to run",
          },
        },
        required: ["query"],
      },
    },
  },
};

export async function generateDraft(ctx: DraftContext): Promise<string> {
  const historyStr = buildHistoryStr(ctx);
  const systemPrompt = buildSystemPrompt(ctx);
  const userMessage = buildUserMessage(ctx, historyStr);

  // First LLM call — model may decide to search the web
  const firstResponse = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.SONNET_4_6,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
      toolConfig: {
        tools: [webSearchTool],
        toolChoice: { auto: {} },
      },
      inferenceConfig: { maxTokens: 1024 },
    })
  );

  const firstContent = firstResponse.output?.message?.content ?? [];

  // Check if the model wants to call web_search
  const toolUseBlock = firstContent.find((b) => "toolUse" in b);

  if (toolUseBlock && "toolUse" in toolUseBlock && toolUseBlock.toolUse?.name === "web_search") {
    const toolUse = toolUseBlock.toolUse;
    const input = toolUse.input as { query?: string };
    const query = input?.query ?? "";

    // Run the search
    const searchResults = await tavilySearch(query, { maxResults: 5 });
    const searchContext = searchResults.length
      ? searchResults
          .map((r) => `Source: ${r.title} (${r.url})\n${r.content}`)
          .join("\n\n---\n\n")
      : "No results found.";

    // Second LLM call with search results injected
    const secondResponse = await bedrock.send(
      new ConverseCommand({
        modelId: MODELS.SONNET_4_6,
        system: [{ text: systemPrompt }],
        messages: [
          { role: "user", content: [{ text: userMessage }] },
          {
            role: "assistant",
            content: firstContent,
          },
          {
            role: "user",
            content: [
              {
                toolResult: {
                  toolUseId: toolUse.toolUseId ?? "search_1",
                  content: [{ text: searchContext }],
                },
              },
            ],
          },
        ],
        inferenceConfig: { maxTokens: 1024 },
      })
    );

    const textBlock = secondResponse.output?.message?.content?.find(
      (b) => "text" in b
    );
    return textBlock && "text" in textBlock ? textBlock.text ?? "" : "";
  }

  // No tool call — extract the text directly from first response
  const textBlock = firstContent.find((b) => "text" in b);
  return textBlock && "text" in textBlock ? textBlock.text ?? "" : "";
}
