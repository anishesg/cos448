import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export interface TriageClassification {
  businessCategory:
    | "lead"
    | "active_client"
    | "scheduling"
    | "payment"
    | "admin"
    | "noise";
  urgency: "critical" | "high" | "medium" | "low" | "none";
  businessLeverage:
    | "revenue"
    | "retention"
    | "operational"
    | "administrative"
    | "none";
  agentObjective: string | null;
  summary: string;
  recommendedAction:
    | "auto_handle"
    | "draft_response"
    | "notify_founder"
    | "escalate"
    | "hide";
  confidence: number;
}

const classificationSchema = {
  type: "object" as const,
  properties: {
    businessCategory: {
      type: "string" as const,
      enum: [
        "lead",
        "active_client",
        "scheduling",
        "payment",
        "admin",
        "noise",
      ],
      description: "The business role of this email thread",
    },
    urgency: {
      type: "string" as const,
      enum: ["critical", "high", "medium", "low", "none"],
      description: "How urgently this needs attention",
    },
    businessLeverage: {
      type: "string" as const,
      enum: ["revenue", "retention", "operational", "administrative", "none"],
      description: "What kind of business value is at stake",
    },
    agentObjective: {
      type: "string" as const,
      description:
        'The goal for handling this thread, e.g. "book_consult", "clarify_scope", "confirm_scheduling". Null if no action needed.',
      nullable: true,
    },
    summary: {
      type: "string" as const,
      description:
        "One-line business-context summary of what this thread is about",
    },
    recommendedAction: {
      type: "string" as const,
      enum: [
        "auto_handle",
        "draft_response",
        "notify_founder",
        "escalate",
        "hide",
      ],
      description: "What the system should do with this thread",
    },
    confidence: {
      type: "number" as const,
      description: "Confidence in this classification (0-1)",
      minimum: 0,
      maximum: 1,
    },
  },
  required: [
    "businessCategory",
    "urgency",
    "businessLeverage",
    "agentObjective",
    "summary",
    "recommendedAction",
    "confidence",
  ],
};

export async function classifyEmail(opts: {
  subject: string;
  snippet: string;
  senderEmail: string;
  senderName: string | null;
  messageCount: number;
  direction: string;
  businessType?: string;
  businessContext?: string;
}): Promise<TriageClassification> {
  const systemPrompt = `You are a business-aware email triage agent for a solo ${opts.businessType ?? "service"} business.

Your job is to classify incoming email threads by their business meaning — not just email mechanics.

Key principles:
- A hot lead with medium urgency can matter more than a high-urgency vendor email
- Classify both urgency AND business leverage
- Revenue-related threads always get higher priority
- Scope changes, pricing discussions, and legal matters should be escalated
- Newsletters, automated notifications, and marketing should be classified as noise
${opts.businessContext ? `\nBusiness context:\n${opts.businessContext}` : ""}

Analyze the email and classify it using the provided tool.`;

  const userMessage = `Email thread:
- Subject: ${opts.subject}
- From: ${opts.senderName ? `${opts.senderName} <${opts.senderEmail}>` : opts.senderEmail}
- Messages: ${opts.messageCount}
- Direction: ${opts.direction}
- Snippet: ${opts.snippet}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await bedrock.send(
        new ConverseCommand({
          modelId: MODELS.HAIKU_4_5,
          system: [{ text: systemPrompt }],
          messages: [
            { role: "user", content: [{ text: userMessage }] },
          ],
          toolConfig: {
            tools: [
              {
                toolSpec: {
                  name: "classify_email",
                  description:
                    "Classify an email thread by its business meaning, urgency, and recommended action",
                  inputSchema: { json: classificationSchema },
                },
              },
            ],
            toolChoice: { tool: { name: "classify_email" } },
          },
          inferenceConfig: { maxTokens: 1024 },
        })
      );

      const toolUseBlock = response.output?.message?.content?.find(
        (block) => "toolUse" in block
      );

      if (toolUseBlock && "toolUse" in toolUseBlock && toolUseBlock.toolUse?.input) {
        return toolUseBlock.toolUse.input as unknown as TriageClassification;
      }
      break;
    } catch (err: unknown) {
      const isThrottle = err instanceof Error && err.name === "ThrottlingException";
      if (isThrottle && attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 5000));
        continue;
      }
      throw err;
    }
  }

  return {
    businessCategory: "noise",
    urgency: "none",
    businessLeverage: "none",
    agentObjective: null,
    summary: opts.snippet ?? opts.subject,
    recommendedAction: "hide",
    confidence: 0.3,
  };
}
