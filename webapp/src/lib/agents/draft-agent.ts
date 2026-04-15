import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

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

export async function generateDraftStream(ctx: DraftContext) {
  const historyStr = ctx.messageHistory
    .map(
      (m) =>
        `[${m.direction}${m.senderName ? ` from ${m.senderName}` : ""}${m.sentAt ? ` at ${m.sentAt}` : ""}]: ${m.bodySummary ?? "(no content)"}`
    )
    .join("\n");

  const systemPrompt = `You are a professional email draft agent for a solo ${ctx.businessType ?? "service"} business owner${ctx.founderName ? ` named ${ctx.founderName}` : ""}.

Write a reply to the latest email in this thread. Guidelines:
- Match the tone and formality of the conversation
- Be concise and professional
- If this is a lead, frame the response around moving toward a consult or next step
- If this is a client issue, acknowledge their concern and propose a clear path forward
- Never be pushy or salesy — be helpful and confident
- Sign off naturally (no "Best regards" unless the thread uses that style)
- Write ONLY the email body, no subject line
${ctx.classification?.agentObjective ? `\nObjective: ${ctx.classification.agentObjective.replace(/_/g, " ")}` : ""}
${ctx.businessContext ? `\nBusiness context: ${ctx.businessContext}` : ""}`;

  const userMessage = `Thread subject: ${ctx.threadSubject}
Thread summary: ${ctx.threadSnippet}

Message history:
${historyStr}

${ctx.classification?.summary ? `AI analysis: ${ctx.classification.summary}` : ""}

Write a reply to the most recent inbound message.`;

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

export async function generateDraft(ctx: DraftContext): Promise<string> {
  const stream = await generateDraftStream(ctx);
  if (!stream) throw new Error("No stream returned");

  let draft = "";
  for await (const event of stream) {
    if (
      event.contentBlockDelta &&
      event.contentBlockDelta.delta &&
      "text" in event.contentBlockDelta.delta
    ) {
      draft += event.contentBlockDelta.delta.text ?? "";
    }
  }
  return draft;
}
