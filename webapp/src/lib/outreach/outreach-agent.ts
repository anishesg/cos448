import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const classifyLeadSchema = {
  type: "object" as const,
  properties: {
    isRelevant: { type: "boolean" as const },
    fitScore: { type: "number" as const, minimum: 0, maximum: 100 },
    reasoning: { type: "string" as const },
    suggestedApproach: { type: "string" as const },
  },
  required: ["isRelevant", "fitScore", "reasoning", "suggestedApproach"],
};

export async function classifyOutreachLead(opts: {
  name: string;
  profileUrl?: string;
  bio?: string;
  company?: string;
  targetCriteria: string;
  businessType?: string;
}): Promise<{
  isRelevant: boolean;
  fitScore: number;
  reasoning: string;
  suggestedApproach: string;
}> {
  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.HAIKU_4_5,
      system: [
        {
          text: `You classify outreach leads for a solo ${opts.businessType ?? "service"} business. Determine if the lead matches the target criteria and score their fit.`,
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Lead: ${opts.name}${opts.company ? ` at ${opts.company}` : ""}
Bio: ${opts.bio ?? "Unknown"}
Profile: ${opts.profileUrl ?? "N/A"}
Target criteria: ${opts.targetCriteria}

Classify this lead.`,
            },
          ],
        },
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "classify_lead",
              description: "Classify an outreach lead by fit",
              inputSchema: { json: classifyLeadSchema },
            },
          },
        ],
        toolChoice: { tool: { name: "classify_lead" } },
      },
      inferenceConfig: { maxTokens: 512 },
    })
  );

  const toolBlock = response.output?.message?.content?.find(
    (b) => "toolUse" in b
  );

  if (toolBlock && "toolUse" in toolBlock && toolBlock.toolUse?.input) {
    return toolBlock.toolUse.input as {
      isRelevant: boolean;
      fitScore: number;
      reasoning: string;
      suggestedApproach: string;
    };
  }

  return {
    isRelevant: false,
    fitScore: 0,
    reasoning: "Classification failed",
    suggestedApproach: "Skip",
  };
}

export async function personalizeOutreachMessage(opts: {
  channel: "facebook" | "linkedin" | "email";
  leadName: string;
  leadCompany?: string;
  leadBio?: string;
  messageTemplate: string;
  founderName?: string;
  businessType?: string;
}): Promise<string> {
  const channelInstructions = {
    facebook:
      "Write a short, casual Facebook Messenger message. Keep it under 3 sentences. No formal greetings.",
    linkedin:
      "Write a professional LinkedIn message. Keep it under 4 sentences. Include a specific reason for connecting.",
    email:
      "Write a personalized cold email. Include subject line on the first line. Keep body under 5 sentences.",
  };

  const response = await bedrock.send(
    new ConverseStreamCommand({
      modelId: MODELS.SONNET_4_6,
      system: [
        {
          text: `You personalize outreach messages for a solo ${opts.businessType ?? "service"} business${opts.founderName ? ` owner named ${opts.founderName}` : ""}.

${channelInstructions[opts.channel]}

Template to personalize: ${opts.messageTemplate}

Make it sound human and specific to the recipient. Never use "I hope this finds you well." Be genuine and concise.`,
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Personalize for: ${opts.leadName}${opts.leadCompany ? ` at ${opts.leadCompany}` : ""}${opts.leadBio ? `\nBio: ${opts.leadBio}` : ""}`,
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
