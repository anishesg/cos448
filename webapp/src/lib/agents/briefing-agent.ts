import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

interface MeetingBriefInput {
  eventTitle: string;
  eventTime: string;
  duration: string;
  attendees: string[];
  threadHistory: string;
  contactInfo: string;
  businessType?: string;
  founderName?: string;
}

export async function generateMeetingBrief(
  input: MeetingBriefInput
): Promise<string> {
  const systemPrompt = `You are a meeting prep assistant for a solo ${input.businessType ?? "service"} business${input.founderName ? ` owner named ${input.founderName}` : ""}.

Generate a compact pre-meeting brief with these sections (use markdown headers):
## Who They Are
Brief company + role summary

## Why They're Here
Inferred from thread history and booking context

## Signals of Intent
Evidence of interest level (reply speed, pricing questions, referral source, etc.)

## Likely Objections
What might block the deal

## Recommended Goal
What the founder should aim for in this meeting — be specific and action-oriented

## Suggested Structure
3-4 bullet points for how to run the meeting

## Cheat Responses
2-3 one-liners the founder can use

## Red Flags
Things to watch out for

Be concise. Each section should be 1-3 sentences or bullets. The entire brief should be skimmable in 20 seconds.`;

  const userMessage = `Meeting: ${input.eventTitle}
Time: ${input.eventTime} (${input.duration})
Attendees: ${input.attendees.join(", ")}

Thread/Contact context:
${input.threadHistory}

Contact info:
${input.contactInfo}`;

  const response = await bedrock.send(
    new ConverseStreamCommand({
      modelId: MODELS.SONNET_4_6,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 2048 },
    })
  );

  let brief = "";
  if (response.stream) {
    for await (const event of response.stream) {
      if (
        event.contentBlockDelta?.delta &&
        "text" in event.contentBlockDelta.delta
      ) {
        brief += event.contentBlockDelta.delta.text ?? "";
      }
    }
  }

  return brief;
}
