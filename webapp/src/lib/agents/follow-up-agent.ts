import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export type FollowUpStage =
  | "inbound"
  | "qualified"
  | "initial_reply_drafted"
  | "initial_reply_sent"
  | "awaiting_response"
  | "response_received"
  | "tentative_interest"
  | "objection"
  | "scheduling"
  | "times_proposed"
  | "meeting_booked"
  | "nudge_due"
  | "stale"
  | "escalated"
  | "disqualified";

export type ResponseStrategy =
  | "direct_nudge"
  | "soft_checkin"
  | "value_add"
  | "scheduling_push"
  | "clarify_question"
  | "graceful_close";

const stageAssessmentSchema = {
  type: "object" as const,
  properties: {
    currentStage: {
      type: "string" as const,
      enum: [
        "awaiting_response",
        "tentative_interest",
        "objection",
        "scheduling",
        "stale",
        "escalated",
      ],
    },
    nextAction: {
      type: "string" as const,
      enum: [
        "wait",
        "nudge",
        "schedule",
        "escalate",
        "close",
        "draft_response",
      ],
    },
    responseStrategy: {
      type: "string" as const,
      enum: [
        "direct_nudge",
        "soft_checkin",
        "value_add",
        "scheduling_push",
        "clarify_question",
        "graceful_close",
      ],
    },
    waitDurationHours: { type: "number" as const },
    shouldEscalate: { type: "boolean" as const },
    escalationReason: { type: "string" as const, nullable: true },
    reasoning: { type: "string" as const },
  },
  required: [
    "currentStage",
    "nextAction",
    "responseStrategy",
    "waitDurationHours",
    "shouldEscalate",
    "escalationReason",
    "reasoning",
  ],
};

export interface StageAssessment {
  currentStage: FollowUpStage;
  nextAction: string;
  responseStrategy: ResponseStrategy;
  waitDurationHours: number;
  shouldEscalate: boolean;
  escalationReason: string | null;
  reasoning: string;
}

export async function assessFollowUpStage(opts: {
  threadSubject: string;
  threadSnippet: string;
  currentStage: string;
  attemptCount: number;
  daysSinceLastAction: number;
  lastResponseSnippet?: string;
  businessType?: string;
}): Promise<StageAssessment> {
  const systemPrompt = `You are a follow-up strategy planner for a solo ${opts.businessType ?? "service"} business.

Analyze the current state of a follow-up sequence and determine the optimal next action.

Key principles:
- Silence can be meaningful — don't nudge too aggressively
- After 3 nudges without response, consider graceful close
- If the lead pushes on pricing, scope changes, or emotional topics, escalate to the founder
- Vary strategy: don't send the same type of message twice in a row
- For scheduling, be direct but not pushy
- Wait times should increase with each attempt (48h → 72h → 96h)`;

  const userMessage = `Follow-up sequence state:
- Subject: ${opts.threadSubject}
- Current stage: ${opts.currentStage}
- Attempts so far: ${opts.attemptCount}
- Days since last action: ${opts.daysSinceLastAction}
- Snippet: ${opts.threadSnippet}
${opts.lastResponseSnippet ? `- Latest response: ${opts.lastResponseSnippet}` : "- No response received yet"}`;

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.SONNET_4_5,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "assess_stage",
              description:
                "Assess follow-up sequence state and recommend next action",
              inputSchema: { json: stageAssessmentSchema },
            },
          },
        ],
        toolChoice: { tool: { name: "assess_stage" } },
      },
      inferenceConfig: { maxTokens: 1024 },
    })
  );

  const toolBlock = response.output?.message?.content?.find(
    (b) => "toolUse" in b
  );

  if (toolBlock && "toolUse" in toolBlock && toolBlock.toolUse?.input) {
    return toolBlock.toolUse.input as unknown as StageAssessment;
  }

  return {
    currentStage: opts.currentStage as FollowUpStage,
    nextAction: "wait",
    responseStrategy: "soft_checkin",
    waitDurationHours: 72,
    shouldEscalate: false,
    escalationReason: null,
    reasoning: "Could not assess — defaulting to wait",
  };
}

export async function generateFollowUpMessage(opts: {
  strategy: ResponseStrategy;
  threadSubject: string;
  context: string;
  attemptNumber: number;
  founderName?: string;
}): Promise<string> {
  const strategyInstructions: Record<ResponseStrategy, string> = {
    direct_nudge: "Write a brief, direct follow-up checking if they had a chance to review",
    soft_checkin: "Write a warm, low-pressure check-in that doesn't feel like a follow-up",
    value_add: "Share something valuable (insight, resource, observation) and casually reconnect",
    scheduling_push: "Propose specific times to meet and make it easy to say yes",
    clarify_question: "Ask a thoughtful question that re-engages the conversation",
    graceful_close: "Write a respectful close-the-loop message that leaves the door open",
  };

  const response = await bedrock.send(
    new ConverseStreamCommand({
      modelId: MODELS.SONNET_4_6,
      system: [
        {
          text: `You are writing a follow-up email for a solo service business${opts.founderName ? ` owner named ${opts.founderName}` : ""}. This is attempt #${opts.attemptNumber}.

Strategy: ${strategyInstructions[opts.strategy]}

Keep it short (2-4 sentences max). Sound human, not automated. No "I hope this finds you well."`,
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Thread: ${opts.threadSubject}\nContext: ${opts.context}\n\nWrite the follow-up email body only.`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 512 },
    })
  );

  let message = "";
  if (response.stream) {
    for await (const event of response.stream) {
      if (
        event.contentBlockDelta?.delta &&
        "text" in event.contentBlockDelta.delta
      ) {
        message += event.contentBlockDelta.delta.text ?? "";
      }
    }
  }

  return message;
}
