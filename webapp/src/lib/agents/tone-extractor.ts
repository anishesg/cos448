import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export interface WritingStyle {
  tone: string;
  formality: string;
  signOff: string;
  traits: string[];
  avoidances: string[];
  examplePhrases: string[];
  summary: string;
}

const styleSchema = {
  type: "object" as const,
  properties: {
    tone: {
      type: "string" as const,
      description: "Overall tone (e.g., 'warm and professional', 'casual and friendly', 'direct and efficient')",
    },
    formality: {
      type: "string" as const,
      enum: ["very_formal", "formal", "professional_casual", "casual", "very_casual"],
    },
    signOff: {
      type: "string" as const,
      description: "How they typically sign off emails (e.g., 'Best,', 'Thanks!', just name, etc.)",
    },
    traits: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Key writing traits (e.g., 'uses exclamation points', 'asks follow-up questions', 'provides context')",
    },
    avoidances: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Things they avoid in writing (e.g., 'em dashes', 'overly formal language', 'jargon')",
    },
    examplePhrases: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Characteristic phrases they use often",
    },
    summary: {
      type: "string" as const,
      description: "One paragraph summary of their writing style for use as a system prompt",
    },
  },
  required: ["tone", "formality", "signOff", "traits", "avoidances", "examplePhrases", "summary"],
};

export async function extractWritingStyle(sentEmails: string[]): Promise<WritingStyle> {
  const emailSamples = sentEmails.slice(0, 15).join("\n\n---EMAIL---\n\n");

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODELS.SONNET_4_5,
      system: [{
        text: `You are a writing style analyst. Analyze the founder's sent emails and extract their distinctive writing style. Focus on:
- Tone and warmth level
- Formality level
- Signature phrases and patterns
- Things they consistently avoid
- How they open and close emails
- Sentence structure preferences

Be specific and observational, not generic.`,
      }],
      messages: [{
        role: "user",
        content: [{
          text: `Here are sent emails from the founder. Analyze their writing style:\n\n${emailSamples}`,
        }],
      }],
      toolConfig: {
        tools: [{
          toolSpec: {
            name: "extract_style",
            description: "Extract the founder's writing style from their emails",
            inputSchema: { json: styleSchema },
          },
        }],
        toolChoice: { tool: { name: "extract_style" } },
      },
      inferenceConfig: { maxTokens: 1024 },
    })
  );

  const toolUseBlock = response.output?.message?.content?.find(
    (block) => "toolUse" in block
  );
  if (toolUseBlock && "toolUse" in toolUseBlock && toolUseBlock.toolUse?.input) {
    return toolUseBlock.toolUse.input as unknown as WritingStyle;
  }

  return {
    tone: "warm and professional",
    formality: "professional_casual",
    signOff: "Best",
    traits: ["friendly", "concise"],
    avoidances: ["em dashes", "overly formal language"],
    examplePhrases: [],
    summary: "Writes in a warm, professional tone. Keeps messages concise and friendly.",
  };
}
