import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export interface CustomerPersona {
  name: string;
  email: string;
  backstory: string;
  childName?: string;
  interests?: string[];
  concerns?: string[];
}

export const TEST_PERSONAS: Record<string, CustomerPersona> = {
  "kapil.kataria": {
    name: "Kapil Kataria",
    email: "kapil.kataria@easyprincetoncourses.com",
    backstory:
      "Parent of a high school junior. Software engineer by profession. Very analytical, wants data-driven college consulting. Interested in top CS programs for his son.",
    childName: "Arjun",
    interests: ["computer science", "MIT", "Stanford", "Carnegie Mellon"],
    concerns: ["ROI of consulting", "essay quality", "SAT prep strategy"],
  },
  "vikram.kakaria": {
    name: "Vikram Kakaria",
    email: "vikram.kakaria@easyprincetoncourses.com",
    backstory:
      "Parent of twin daughters, both high school seniors. Works in finance. Wants Ivy League placements, willing to invest heavily. Slightly impatient but warm.",
    childName: "Priya and Neha",
    interests: ["economics", "pre-med", "Columbia", "UPenn", "Princeton"],
    concerns: [
      "timeline pressure",
      "early decision strategy",
      "extracurricular positioning",
    ],
  },
  "sanketh.kamath": {
    name: "Sanketh Kamath",
    email: "sanketh.kamath@easyprincetoncourses.com",
    backstory:
      "Recent college grad now mentoring his younger sister. Very tech-savvy, researches everything online. Wants affordable consulting for his sister who's a sophomore.",
    childName: "Anya (sister)",
    interests: ["biomedical engineering", "research opportunities", "scholarships"],
    concerns: ["budget constraints", "long-term planning", "sophomore year prep"],
  },
};

interface ConversationTurn {
  role: "customer" | "business";
  content: string;
}

export async function generateCustomerReply(opts: {
  persona: CustomerPersona;
  conversationHistory: ConversationTurn[];
  turnNumber: number;
  maxTurns: number;
  businessName?: string;
}): Promise<string> {
  const progressRatio = opts.turnNumber / opts.maxTurns;

  let stageGuidance: string;
  if (progressRatio < 0.25) {
    stageGuidance =
      "You're in the INITIAL INQUIRY phase. Ask about services, express your situation, and show genuine interest. Be a bit cautious but friendly.";
  } else if (progressRatio < 0.5) {
    stageGuidance =
      "You're in the ENGAGEMENT phase. Ask specific questions about pricing, process, and what makes this consultant different. Share more about your child's situation.";
  } else if (progressRatio < 0.75) {
    stageGuidance =
      "You're WARMING UP. Express that you're impressed and leaning toward signing up. Ask about next steps and availability. Mention you'd like to schedule an introductory call.";
  } else {
    stageGuidance =
      "You're READY TO COMMIT. You want to schedule a meeting/consultation. Suggest specific days or ask for their availability. Be enthusiastic about getting started.";
  }

  const historyStr = opts.conversationHistory
    .map(
      (t) =>
        `[${t.role === "customer" ? opts.persona.name : "Consultant"}]: ${t.content}`
    )
    .join("\n\n");

  const systemPrompt = `You are ${opts.persona.name}, a real person with the following background:
${opts.persona.backstory}

You are emailing a college consulting business${opts.businessName ? ` (${opts.businessName})` : ""} about getting help for ${opts.persona.childName ?? "your child"}.

Your interests: ${opts.persona.interests?.join(", ") ?? "college admissions"}
Your concerns: ${opts.persona.concerns?.join(", ") ?? "general"}

RULES:
- Write as a REAL person would — casual, warm, genuine
- Keep emails short (2-4 paragraphs max)
- Reference your real background naturally
- Don't be overly formal or robotic
- Include personal touches and real emotions
- ${stageGuidance}
- This is turn ${opts.turnNumber} of approximately ${opts.maxTurns}
- Write ONLY the email body, no subject line, no "From:" headers`;

  const userMessage = opts.conversationHistory.length > 0
    ? `Here's the conversation so far:\n\n${historyStr}\n\nWrite your next reply as ${opts.persona.name}. Remember: ${stageGuidance}`
    : `Write an initial email to a college consulting company. You found them through a Facebook parent group. Introduce yourself and express interest in their services. Be natural and genuine.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await bedrock.send(
        new ConverseCommand({
          modelId: MODELS.SONNET_4_6,
          system: [{ text: systemPrompt }],
          messages: [{ role: "user", content: [{ text: userMessage }] }],
          inferenceConfig: { maxTokens: 1024 },
        })
      );

      const textBlock = response.output?.message?.content?.find(
        (b) => "text" in b
      );
      if (textBlock && "text" in textBlock && textBlock.text) {
        return textBlock.text;
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

  return `Hi there,\n\nI'm really interested in learning more about your consulting services for my child. Could we set up a time to chat?\n\nBest,\n${opts.persona.name}`;
}
