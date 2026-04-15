import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";
import { db } from "@/lib/db";
import { trustRules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export interface RiskAssessment {
  irreversibility: "none" | "low" | "medium" | "high";
  financialImpact: boolean;
  legalSensitivity: boolean;
  novelty: "routine" | "unusual" | "novel";
  modelConfidence: number;
  businessRuleViolations: string[];
  founderHistoryMatch: boolean;
}

export type ActionDecision =
  | { action: "auto_execute"; reason: string }
  | { action: "draft_only"; reason: string }
  | { action: "notify"; reason: string }
  | { action: "escalate"; reason: string; riskFactors: string[] }
  | { action: "block"; reason: string };

const riskSchema = {
  type: "object" as const,
  properties: {
    irreversibility: {
      type: "string" as const,
      enum: ["none", "low", "medium", "high"],
    },
    financialImpact: { type: "boolean" as const },
    legalSensitivity: { type: "boolean" as const },
    novelty: {
      type: "string" as const,
      enum: ["routine", "unusual", "novel"],
    },
    confidence: { type: "number" as const, minimum: 0, maximum: 1 },
    riskFactors: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    recommendedAction: {
      type: "string" as const,
      enum: ["auto_execute", "draft_only", "notify", "escalate", "block"],
    },
    reasoning: { type: "string" as const },
  },
  required: [
    "irreversibility",
    "financialImpact",
    "legalSensitivity",
    "novelty",
    "confidence",
    "riskFactors",
    "recommendedAction",
    "reasoning",
  ],
};

interface RiskCheckInput {
  actionType: string;
  threadSubject: string;
  draftContent: string;
  classification: Record<string, unknown> | null;
  businessType?: string;
}

export async function assessRisk(
  input: RiskCheckInput
): Promise<{ assessment: RiskAssessment; decision: ActionDecision }> {
  const systemPrompt = `You are a risk assessment engine for a solo service business AI assistant. Your job is to evaluate whether a proposed agent action is safe to execute automatically, needs human review, or should be escalated.

ALWAYS escalate (regardless of confidence) when the action:
- Involves money, pricing, or payment terms
- Changes scope or commitments
- Touches legal language or contracts
- Books over protected calendar time
- Affects client commitments or deadlines
- Is a novel situation not seen before

For routine actions (scheduling confirmations, simple follow-ups, newsletter handling), allow auto-execution.`;

  const userMessage = `Evaluate this proposed action:
- Action type: ${input.actionType}
- Thread subject: ${input.threadSubject}
- Draft content: ${input.draftContent}
- Classification: ${JSON.stringify(input.classification ?? {})}
- Business type: ${input.businessType ?? "unknown"}`;

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.SONNET_4_5,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "assess_risk",
              description:
                "Assess the risk of a proposed agent action and recommend whether to auto-execute, draft, notify, escalate, or block",
              inputSchema: { json: riskSchema },
            },
          },
        ],
        toolChoice: { tool: { name: "assess_risk" } },
      },
      inferenceConfig: { maxTokens: 1024 },
    })
  );

  const toolUseBlock = response.output?.message?.content?.find(
    (block) => "toolUse" in block
  );

  if (
    toolUseBlock &&
    "toolUse" in toolUseBlock &&
    toolUseBlock.toolUse?.input
  ) {
    const result = toolUseBlock.toolUse.input as Record<string, unknown>;
    const assessment: RiskAssessment = {
      irreversibility: (result.irreversibility as RiskAssessment["irreversibility"]) ?? "low",
      financialImpact: (result.financialImpact as boolean) ?? false,
      legalSensitivity: (result.legalSensitivity as boolean) ?? false,
      novelty: (result.novelty as RiskAssessment["novelty"]) ?? "routine",
      modelConfidence: (result.confidence as number) ?? 0.5,
      businessRuleViolations: (result.riskFactors as string[]) ?? [],
      founderHistoryMatch: true,
    };

    const action = (result.recommendedAction as string) ?? "draft_only";
    const reasoning = (result.reasoning as string) ?? "";

    let decision: ActionDecision;
    switch (action) {
      case "auto_execute":
        decision = { action: "auto_execute", reason: reasoning };
        break;
      case "escalate":
        decision = {
          action: "escalate",
          reason: reasoning,
          riskFactors: assessment.businessRuleViolations,
        };
        break;
      case "notify":
        decision = { action: "notify", reason: reasoning };
        break;
      case "block":
        decision = { action: "block", reason: reasoning };
        break;
      default:
        decision = { action: "draft_only", reason: reasoning };
    }

    return { assessment, decision };
  }

  // Fallback: always draft-only if risk assessment fails
  return {
    assessment: {
      irreversibility: "low",
      financialImpact: false,
      legalSensitivity: false,
      novelty: "unusual",
      modelConfidence: 0.3,
      businessRuleViolations: ["Risk assessment failed — defaulting to manual review"],
      founderHistoryMatch: false,
    },
    decision: {
      action: "draft_only",
      reason: "Risk assessment failed. Requiring manual review.",
    },
  };
}

export async function getUserTrustRules(userId: string) {
  return db
    .select()
    .from(trustRules)
    .where(eq(trustRules.userId, userId));
}

export async function checkTrustRuleOverride(
  userId: string,
  category: string
): Promise<string | null> {
  const [rule] = await db
    .select()
    .from(trustRules)
    .where(
      and(eq(trustRules.userId, userId), eq(trustRules.category, category))
    )
    .limit(1);

  return rule?.autonomyLevel ?? null;
}
