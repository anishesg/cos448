import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type Message,
  type SystemContentBlock,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";

export const MODELS = {
  SONNET_4_6: "us.anthropic.claude-sonnet-4-6",
  SONNET_4_5: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  HAIKU_4_5: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  OPUS_4_5: "us.anthropic.claude-opus-4-5-20251101-v1:0",
} as const;

export type BedrockModelId = (typeof MODELS)[keyof typeof MODELS];

interface AgentTask {
  requiresStructuredOutput: boolean;
  requiresToolCalling: boolean;
  complexity: "low" | "medium" | "high" | "extreme";
}

export function selectModel(task: AgentTask): BedrockModelId {
  if (task.requiresStructuredOutput || task.requiresToolCalling) {
    if (task.complexity === "low") return MODELS.HAIKU_4_5;
    if (task.complexity === "high") return MODELS.OPUS_4_5;
    return MODELS.SONNET_4_5;
  }
  if (task.complexity === "extreme") return MODELS.OPUS_4_5;
  return MODELS.SONNET_4_6;
}

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export async function converseStructured(opts: {
  modelId: BedrockModelId;
  system?: string;
  messages: Message[];
  tools: Tool[];
  maxTokens?: number;
}) {
  const command = new ConverseCommand({
    modelId: opts.modelId,
    system: opts.system ? [{ text: opts.system } as SystemContentBlock] : undefined,
    messages: opts.messages,
    toolConfig: { tools: opts.tools },
    inferenceConfig: { maxTokens: opts.maxTokens ?? 4096 },
  });
  return bedrockClient.send(command);
}

export async function converseStream(opts: {
  modelId: BedrockModelId;
  system?: string;
  messages: Message[];
  maxTokens?: number;
}) {
  const command = new ConverseStreamCommand({
    modelId: opts.modelId,
    system: opts.system ? [{ text: opts.system } as SystemContentBlock] : undefined,
    messages: opts.messages,
    inferenceConfig: { maxTokens: opts.maxTokens ?? 4096 },
  });
  return bedrockClient.send(command);
}

export { bedrockClient };
