import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { getTodayBudget, incrementBudget } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const systemPrompt = fs.readFileSync(
  path.join(__dirname, "..", "templates", "classifier-prompt.txt"),
  "utf8"
);

// Tool spec for structured classification output
const classifyTool = {
  name: "classify_lead",
  description: "Classify whether a Facebook comment indicates a potential college consulting lead.",
  inputSchema: {
    json: {
      type: "object",
      properties: {
        is_lead: {
          type: "boolean",
          description: "Whether this person is a potential lead (parent of HS/MS student needing college help)",
        },
        reason: {
          type: "string",
          description: "Brief explanation of why this is or isn't a lead",
        },
        confidence: {
          type: "number",
          description: "Confidence score from 0.0 to 1.0",
        },
      },
      required: ["is_lead", "reason", "confidence"],
      additionalProperties: false,
    },
  },
};

// Nova Micro pricing (per 1M tokens)
const PRICING = {
  "us.amazon.nova-micro-v1:0": { input: 0.035, output: 0.14 },
  "us.amazon.nova-lite-v1:0": { input: 0.06, output: 0.24 },
};

/**
 * Check if we're within the daily LLM budget.
 */
export function isBudgetExceeded() {
  const budget = getTodayBudget();
  return budget.estimated_cost_usd >= config.fbFinder.dailyLlmBudgetUsd;
}

/**
 * Classify a Facebook comment to determine if the commenter is a potential lead.
 *
 * @param {string} commentText - The comment content
 * @param {string} postContext - Optional context from the parent post
 * @returns {{ isLead: boolean, reason: string, confidence: number, tokens: { input: number, output: number } }}
 */
export async function classifyComment(commentText, postContext = "") {
  if (isBudgetExceeded()) {
    return { isLead: false, reason: "Daily LLM budget exceeded", confidence: 0, tokens: { input: 0, output: 0 } };
  }

  const modelId = config.fbFinder.classifierModel;
  const token = config.bedrock.bearerToken;
  const region = config.bedrock.region;
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;

  const userPrompt = postContext
    ? `Post context: "${postContext.slice(0, 300)}"\n\nComment to classify: "${commentText.slice(0, 500)}"\n\nCall the classify_lead tool with your assessment.`
    : `Comment to classify: "${commentText.slice(0, 500)}"\n\nCall the classify_lead tool with your assessment.`;

  const payload = {
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [{ text: userPrompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 256,
      temperature: 0.1,
    },
    toolConfig: {
      tools: [{ toolSpec: classifyTool }],
      toolChoice: {
        tool: { name: "classify_lead" },
      },
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
    throw new Error(`Bedrock classifier error (${response.status}) [${modelId}]: ${text}`);
  }

  const data = await response.json();

  // Track token usage
  const usage = data.usage || {};
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  const pricing = PRICING[modelId] || PRICING["us.amazon.nova-micro-v1:0"];
  const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

  incrementBudget({ inputTokens, outputTokens, costUsd });

  // Extract tool use result
  const toolUseBlock = data.output?.message?.content?.find(
    (block) => block.toolUse
  );

  if (toolUseBlock?.toolUse?.input) {
    const { is_lead, reason, confidence } = toolUseBlock.toolUse.input;
    return {
      isLead: !!is_lead,
      reason: reason || "",
      confidence: typeof confidence === "number" ? confidence : 0,
      tokens: { input: inputTokens, output: outputTokens },
    };
  }

  // Fallback: if tool calling didn't work, default to not-a-lead
  return {
    isLead: false,
    reason: "Could not parse classifier response",
    confidence: 0,
    tokens: { input: inputTokens, output: outputTokens },
  };
}

/**
 * Batch classify multiple comments (sequential to respect rate limits).
 * Stops early if budget is exceeded.
 *
 * @param {Array<{ text: string, postContext?: string }>} comments
 * @returns {Array<{ isLead: boolean, reason: string, confidence: number, tokens: { input: number, output: number } }>}
 */
export async function batchClassify(comments) {
  const results = [];
  for (const comment of comments) {
    if (isBudgetExceeded()) {
      results.push({ isLead: false, reason: "Budget exceeded", confidence: 0, tokens: { input: 0, output: 0 } });
      continue;
    }
    try {
      const result = await classifyComment(comment.text, comment.postContext || "");
      results.push(result);
    } catch (err) {
      console.error(`Classification error: ${err.message}`);
      results.push({ isLead: false, reason: `Error: ${err.message}`, confidence: 0, tokens: { input: 0, output: 0 } });
    }
  }
  return results;
}
