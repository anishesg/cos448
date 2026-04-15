/**
 * Linq AI agent — the brain behind iMessage commands.
 *
 * Receives an incoming iMessage, runs a Bedrock tool-calling loop to decide
 * what to do, and returns a concise text reply.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type Tool,
  type ToolResultBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { MODELS } from "@/lib/bedrock";
import { db } from "@/lib/db";
import {
  emailThreads,
  contacts,
  emailMessages,
  agentActions,
} from "@/lib/db/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    toolSpec: {
      name: "get_status",
      description:
        "Returns a summary of today's CRM activity: thread counts, urgent items, recent leads.",
      inputSchema: { json: { type: "object", properties: {}, required: [] } },
    },
  },
  {
    toolSpec: {
      name: "get_thread_detail",
      description:
        "Fetches subject, recent messages, and draft status for a specific thread.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            threadId: { type: "string", description: "The UUID of the thread" },
          },
          required: ["threadId"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "list_hot_leads",
      description: "Returns the top 5 leads by urgency and fit score.",
      inputSchema: { json: { type: "object", properties: {}, required: [] } },
    },
  },
  {
    toolSpec: {
      name: "send_email_draft",
      description:
        "Sends the pending AI draft for the given thread. Only call after explicit user confirmation.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            threadId: { type: "string", description: "The UUID of the thread" },
          },
          required: ["threadId"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "escalate_to_human",
      description: "Marks a thread for human review.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            threadId: { type: "string" },
            reason: { type: "string" },
          },
          required: ["threadId", "reason"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "search_contacts",
      description: "Fuzzy search contacts by name.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            query: { type: "string", description: "Name fragment to search" },
          },
          required: ["query"],
        },
      },
    },
  },
];

// ─── Tool implementations ────────────────────────────────────────────────────

async function toolGetStatus(userId: string): Promise<string> {
  const allThreads = await db
    .select({
      id: emailThreads.id,
      urgency: emailThreads.urgency,
      businessCategory: emailThreads.businessCategory,
      currentState: emailThreads.currentState,
      lastMessageDirection: emailThreads.lastMessageDirection,
    })
    .from(emailThreads)
    .where(eq(emailThreads.userId, userId))
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(100);

  const total = allThreads.length;
  const urgent = allThreads.filter(
    (t) => t.urgency === "critical" || t.urgency === "high"
  ).length;
  const leads = allThreads.filter((t) => t.businessCategory === "lead").length;
  const draftsReady = allThreads.filter((t) => t.currentState === "draft_ready").length;
  const needsReply = allThreads.filter(
    (t) => t.lastMessageDirection === "inbound" && t.currentState !== "hidden"
  ).length;

  return JSON.stringify({ total, urgent, leads, draftsReady, needsReply });
}

async function toolGetThreadDetail(
  userId: string,
  threadId: string
): Promise<string> {
  const [thread] = await db
    .select()
    .from(emailThreads)
    .where(and(eq(emailThreads.id, threadId), eq(emailThreads.userId, userId)))
    .limit(1);

  if (!thread) return JSON.stringify({ error: "Thread not found" });

  const messages = await db
    .select({
      direction: emailMessages.direction,
      senderName: emailMessages.senderName,
      bodySummary: emailMessages.bodySummary,
      sentAt: emailMessages.sentAt,
    })
    .from(emailMessages)
    .where(eq(emailMessages.threadId, threadId))
    .orderBy(desc(emailMessages.sentAt))
    .limit(5);

  // Look for a pending draft in agent actions
  const [latestDraft] = await db
    .select({ output: agentActions.output })
    .from(agentActions)
    .where(
      and(
        eq(agentActions.userId, userId),
        eq(agentActions.threadId, threadId),
        eq(agentActions.actionType, "draft_generated")
      )
    )
    .orderBy(desc(agentActions.createdAt))
    .limit(1);

  const draftContent =
    latestDraft?.output && typeof latestDraft.output === "object" && "draft" in latestDraft.output
      ? (latestDraft.output as { draft: string }).draft
      : null;

  return JSON.stringify({
    id: thread.id,
    subject: thread.subject,
    urgency: thread.urgency,
    businessCategory: thread.businessCategory,
    currentState: thread.currentState,
    recentMessages: messages,
    draftReady: thread.currentState === "draft_ready",
    draftContent: draftContent ? draftContent.substring(0, 300) + "..." : null,
  });
}

async function toolListHotLeads(userId: string): Promise<string> {
  const rows = await db
    .select({
      threadId: emailThreads.id,
      subject: emailThreads.subject,
      urgency: emailThreads.urgency,
      fitScore: contacts.fitScore,
      contactName: contacts.name,
      contactEmail: contacts.email,
    })
    .from(emailThreads)
    .leftJoin(contacts, eq(emailThreads.contactId, contacts.id))
    .where(
      and(
        eq(emailThreads.userId, userId),
        eq(emailThreads.businessCategory, "lead")
      )
    )
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(5);

  return JSON.stringify({ leads: rows });
}

async function toolSendEmailDraft(
  userId: string,
  threadId: string
): Promise<string> {
  // Calls the internal send endpoint
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Retrieve the draft content from agent actions
  const [latestDraft] = await db
    .select({ output: agentActions.output, id: agentActions.id })
    .from(agentActions)
    .where(
      and(
        eq(agentActions.userId, userId),
        eq(agentActions.threadId, threadId),
        eq(agentActions.actionType, "draft_generated")
      )
    )
    .orderBy(desc(agentActions.createdAt))
    .limit(1);

  if (!latestDraft?.output) {
    return JSON.stringify({ error: "No draft found for this thread" });
  }

  const output = latestDraft.output as Record<string, unknown>;
  const content = typeof output.draft === "string" ? output.draft : null;
  if (!content) return JSON.stringify({ error: "Draft content is empty" });

  const res = await fetch(`${baseUrl}/api/emails/${threadId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, actionId: latestDraft.id }),
  });

  if (!res.ok) return JSON.stringify({ error: `Send failed: ${res.status}` });
  return JSON.stringify({ success: true, message: "Draft sent successfully" });
}

async function toolEscalateToHuman(
  userId: string,
  threadId: string,
  reason: string
): Promise<string> {
  await db
    .update(emailThreads)
    .set({ currentState: "escalated", updatedAt: new Date() })
    .where(and(eq(emailThreads.id, threadId), eq(emailThreads.userId, userId)));

  await db.insert(agentActions).values({
    userId,
    threadId,
    actionType: "escalation",
    agentName: "linq-agent",
    input: { reason },
    output: { escalatedAt: new Date().toISOString() },
    status: "completed",
  });

  return JSON.stringify({ success: true, message: "Thread marked for human review" });
}

async function toolSearchContacts(
  userId: string,
  query: string
): Promise<string> {
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      relationshipType: contacts.relationshipType,
      fitScore: contacts.fitScore,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.userId, userId),
        or(ilike(contacts.name, `%${query}%`), ilike(contacts.email, `%${query}%`))
      )
    )
    .limit(5);

  return JSON.stringify({ contacts: rows });
}

// ─── Tool dispatcher ─────────────────────────────────────────────────────────

async function dispatchTool(
  userId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "get_status":
      return toolGetStatus(userId);
    case "get_thread_detail":
      return toolGetThreadDetail(userId, input.threadId as string);
    case "list_hot_leads":
      return toolListHotLeads(userId);
    case "send_email_draft":
      return toolSendEmailDraft(userId, input.threadId as string);
    case "escalate_to_human":
      return toolEscalateToHuman(
        userId,
        input.threadId as string,
        input.reason as string
      );
    case "search_contacts":
      return toolSearchContacts(userId, input.query as string);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ─── Main agent entry point ──────────────────────────────────────────────────

export async function runLinqAgent(opts: {
  userId: string;
  message: string;
  businessName?: string;
}): Promise<string> {
  const systemPrompt = `You are the AI assistant for ${opts.businessName ?? "the business"}'s CRM system.
You receive commands via iMessage from the business owner.
Be extremely concise — this is iMessage, not email.
Available: status, hot leads, thread details, send draft, search contacts, escalate.
When uncertain, ask ONE clarifying question.
Never send emails without explicit confirmation from the owner.`;

  const messages: Message[] = [
    { role: "user", content: [{ text: opts.message }] },
  ];

  // Agentic loop (max 5 turns to stay within budget)
  for (let turn = 0; turn < 5; turn++) {
    const response = await bedrock.send(
      new ConverseCommand({
        modelId: MODELS.SONNET_4_6,
        system: [{ text: systemPrompt }],
        messages,
        toolConfig: { tools: TOOLS },
        inferenceConfig: { maxTokens: 512 },
      })
    );

    const outputContent = response.output?.message?.content ?? [];
    messages.push({ role: "assistant", content: outputContent });

    const stopReason = response.stopReason;

    // If no more tools to call, extract the text reply
    if (stopReason !== "tool_use") {
      const textBlock = outputContent.find((b) => "text" in b);
      return textBlock && "text" in textBlock
        ? (textBlock.text ?? "Done.")
        : "Done.";
    }

    // Execute all requested tools and collect results
    const toolResultContent: ToolResultBlock[] = [];
    for (const block of outputContent) {
      if (!("toolUse" in block) || !block.toolUse) continue;
      const { toolUseId, name, input } = block.toolUse;
      const result = await dispatchTool(
        opts.userId,
        name ?? "",
        (input ?? {}) as Record<string, unknown>
      );
      toolResultContent.push({
        toolUseId: toolUseId ?? "",
        content: [{ text: result }],
      });
    }

    messages.push({
      role: "user",
      content: toolResultContent.map((r) => ({ toolResult: r })),
    });
  }

  return "I've processed your request.";
}
