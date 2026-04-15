import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { bedrockClient, MODELS } from "@/lib/bedrock";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const SYSTEM_PROMPT = `You are the AI assistant for a college admissions consulting CRM. The user is the business owner.
You have access to their business context. Answer questions about their leads, suggest outreach strategies,
give advice on college admissions topics, or help them think through client situations.
Be concise and practical. Maximum 3-4 sentences unless the question really needs more.`;

export async function POST(request: NextRequest) {
  try {
    await requireApiUser();

    let body: { query?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { query } = body;
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const command = new ConverseCommand({
      modelId: MODELS.SONNET_4_6,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [{ text: query.trim() }],
        },
      ],
      inferenceConfig: { maxTokens: 512 },
    });

    const result = await bedrockClient.send(command);

    const text =
      result.output?.message?.content
        ?.filter((b) => "text" in b)
        .map((b) => (b as { text: string }).text)
        .join("") ?? "";

    return NextResponse.json({ response: text });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("AI command error:", error);
    return NextResponse.json({ error: "Failed to get AI response" }, { status: 500 });
  }
}
