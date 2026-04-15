import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export interface ContactClassification {
  relationshipType: "lead" | "active_client" | "past_client" | "vendor" | "partner" | "personal" | "institutional" | "unknown";
  relationshipStage: "new" | "engaged" | "active" | "dormant" | "closed";
  fitScore: number;
  revenuePotential: "high" | "medium" | "low" | "none";
  notes: string;
}

const classificationSchema = {
  type: "object" as const,
  properties: {
    relationshipType: {
      type: "string" as const,
      enum: ["lead", "active_client", "past_client", "vendor", "partner", "personal", "institutional", "unknown"],
    },
    relationshipStage: {
      type: "string" as const,
      enum: ["new", "engaged", "active", "dormant", "closed"],
    },
    fitScore: {
      type: "number" as const,
      description: "How valuable this contact is to the business (0-100)",
      minimum: 0,
      maximum: 100,
    },
    revenuePotential: {
      type: "string" as const,
      enum: ["high", "medium", "low", "none"],
    },
    notes: {
      type: "string" as const,
      description: "Brief context about who this person is and what they need",
    },
  },
  required: ["relationshipType", "relationshipStage", "fitScore", "revenuePotential", "notes"],
};

export async function classifyContact(opts: {
  email: string;
  name: string | null;
  threadSubjects: string[];
  threadSnippets: string[];
  interactionCount: number;
  directions: string[];
  businessType?: string;
}): Promise<ContactClassification> {
  const systemPrompt = `You are a contact classification agent for a solo ${opts.businessType ?? "service"} business.

Classify this contact based on their email interactions. Determine:
- Their relationship type (lead, active client, vendor, personal, etc.)
- Their current stage (new, engaged, active, dormant)
- A fit score (0-100) based on how valuable they are to the business
- Revenue potential

Use context clues from subjects, snippets, and interaction patterns.`;

  const threadContext = opts.threadSubjects
    .map((subj, i) => `- "${subj}": ${opts.threadSnippets[i] ?? ""}`)
    .slice(0, 5)
    .join("\n");

  const userMessage = `Contact: ${opts.name ? `${opts.name} <${opts.email}>` : opts.email}
Total interactions: ${opts.interactionCount}
Direction pattern: ${opts.directions.join(", ")}

Recent threads:
${threadContext}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await bedrock.send(
        new ConverseCommand({
          modelId: MODELS.HAIKU_4_5,
          system: [{ text: systemPrompt }],
          messages: [{ role: "user", content: [{ text: userMessage }] }],
          toolConfig: {
            tools: [{
              toolSpec: {
                name: "classify_contact",
                description: "Classify a contact by relationship type, stage, and value",
                inputSchema: { json: classificationSchema },
              },
            }],
            toolChoice: { tool: { name: "classify_contact" } },
          },
          inferenceConfig: { maxTokens: 512 },
        })
      );

      const toolUseBlock = response.output?.message?.content?.find(
        (block) => "toolUse" in block
      );
      if (toolUseBlock && "toolUse" in toolUseBlock && toolUseBlock.toolUse?.input) {
        return toolUseBlock.toolUse.input as unknown as ContactClassification;
      }
      break;
    } catch (err: unknown) {
      const isThrottle = err instanceof Error && err.name === "ThrottlingException";
      if (isThrottle && attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 5000));
        continue;
      }
      console.error("Contact classification error:", err);
    }
  }

  return {
    relationshipType: "unknown",
    relationshipStage: "new",
    fitScore: 50,
    revenuePotential: "none",
    notes: "",
  };
}
