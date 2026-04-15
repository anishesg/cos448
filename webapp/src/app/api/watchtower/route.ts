import { NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, emailMessages, emailThreads, followUpWorkflows } from "@/lib/db/schema";
import { eq, and, lt, ne, inArray, desc } from "drizzle-orm";

export interface WatchtowerAlert {
  id: string;
  type:
    | "lead_cooling"
    | "lead_needs_reply"
    | "scheduling_stall"
    | "proposal_forgotten"
    | "client_waiting"
    | "payment_risk"
    | "upsell_window";
  title: string;
  description: string;
  threadId: string;
  threadSubject: string | null;
  /** Contact name, last inbound sender, or short subject — for scannable task rows */
  counterpartyLabel?: string | null;
  daysSinceLastAction: number;
  suggestedAction: string;
  urgency: "high" | "medium" | "low";
}

function hoursSince(date: Date | null, now: Date): number {
  if (!date) return 0;
  return Math.max(0, (now.getTime() - date.getTime()) / (3600 * 1000));
}

function formatAge(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Resolve who the thread is about (contact → inbound sender → subject). */
async function attachCounterpartyLabels(
  userId: string,
  alerts: WatchtowerAlert[]
): Promise<WatchtowerAlert[]> {
  if (alerts.length === 0) return alerts;

  const threadIds = [...new Set(alerts.map((a) => a.threadId))];

  const threadRows = await db
    .select({ id: emailThreads.id, contactId: emailThreads.contactId })
    .from(emailThreads)
    .where(and(eq(emailThreads.userId, userId), inArray(emailThreads.id, threadIds)));

  const threadContact = new Map(threadRows.map((r) => [r.id, r.contactId]));
  const contactIds = [
    ...new Set(threadRows.map((r) => r.contactId).filter((x): x is string => Boolean(x))),
  ];

  const contactRows =
    contactIds.length > 0
      ? await db
          .select({ id: contacts.id, name: contacts.name, email: contacts.email })
          .from(contacts)
          .where(and(eq(contacts.userId, userId), inArray(contacts.id, contactIds)))
      : [];

  const contactById = new Map(contactRows.map((c) => [c.id, c]));

  const threadsNeedingInbound = threadIds.filter((tid) => {
    const cid = threadContact.get(tid) ?? null;
    const c = cid ? contactById.get(cid) : undefined;
    return !c?.name?.trim() && !c?.email?.trim();
  });

  const inboundByThread = new Map<string, string>();
  if (threadsNeedingInbound.length > 0) {
    const inboundMsgs = await db
      .select({
        threadId: emailMessages.threadId,
        senderName: emailMessages.senderName,
        senderEmail: emailMessages.senderEmail,
        sentAt: emailMessages.sentAt,
      })
      .from(emailMessages)
      .where(
        and(inArray(emailMessages.threadId, threadsNeedingInbound), eq(emailMessages.direction, "inbound"))
      )
      .orderBy(desc(emailMessages.sentAt));

    for (const m of inboundMsgs) {
      if (inboundByThread.has(m.threadId)) continue;
      const label = m.senderName?.trim() || m.senderEmail?.trim();
      if (label) inboundByThread.set(m.threadId, label);
    }
  }

  function labelFor(threadId: string, subject: string | null): string | null {
    const cid = threadContact.get(threadId) ?? null;
    const c = cid ? contactById.get(cid) : undefined;
    const fromContact = c?.name?.trim() || c?.email?.trim();
    if (fromContact) return truncateLabel(fromContact, 56);
    const fromInbound = inboundByThread.get(threadId);
    if (fromInbound) return truncateLabel(fromInbound, 56);
    if (subject?.trim()) return truncateLabel(subject.trim(), 48);
    return null;
  }

  return alerts.map((a) => ({
    ...a,
    counterpartyLabel: labelFor(a.threadId, a.threadSubject),
  }));
}

export async function GET() {
  try {
    const user = await requireApiUser();
  const alerts: WatchtowerAlert[] = [];
  const now = new Date();

  // ── Leads needing a reply today (inbound, no outbound yet, any age) ──
  const leadsNeedingReply = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.userId, user.userId),
        eq(emailThreads.businessCategory, "lead"),
        eq(emailThreads.lastMessageDirection, "inbound"),
        ne(emailThreads.currentState, "hidden"),
        ne(emailThreads.currentState, "automated"),
        ne(emailThreads.currentState, "meeting_requested")
      )
    );

  for (const thread of leadsNeedingReply) {
    const hours = hoursSince(thread.lastMessageAt, now);
    const days = Math.floor(hours / 24);
    alerts.push({
      id: `lead_reply_${thread.id}`,
      type: hours >= 72 ? "lead_cooling" : "lead_needs_reply",
      title: hours >= 72 ? "Lead cooling off" : "Lead needs reply",
      description: `Inbound ${formatAge(hours)} — no response yet`,
      threadId: thread.id,
      threadSubject: thread.subject,
      daysSinceLastAction: days,
      suggestedAction:
        hours >= 72
          ? "Send a follow-up with timeline clarity"
          : "Draft a reply to keep momentum",
      urgency: hours >= 72 ? "high" : hours >= 24 ? "medium" : "low",
    });
  }

  // ── Leads with drafts ready but unsent ──
  const draftReadyLeads = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.userId, user.userId),
        eq(emailThreads.businessCategory, "lead"),
        eq(emailThreads.currentState, "draft_ready")
      )
    );

  for (const thread of draftReadyLeads) {
    const hours = hoursSince(thread.updatedAt, now);
    if (leadsNeedingReply.some((t) => t.id === thread.id)) continue;
    alerts.push({
      id: `draft_pending_${thread.id}`,
      type: "lead_needs_reply",
      title: "Draft waiting for review",
      description: `AI draft ready ${formatAge(hours)}`,
      threadId: thread.id,
      threadSubject: thread.subject,
      daysSinceLastAction: Math.floor(hours / 24),
      suggestedAction: "Review and send the AI draft",
      urgency: hours >= 24 ? "medium" : "low",
    });
  }

  // ── Scheduling stalls: threads where client wants to meet but no meeting set ──
  const schedulingStalls = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.userId, user.userId),
        eq(emailThreads.agentObjective, "schedule_meeting"),
        eq(emailThreads.lastMessageDirection, "inbound"),
        ne(emailThreads.currentState, "hidden"),
        ne(emailThreads.currentState, "automated")
      )
    );

  for (const thread of schedulingStalls) {
    const hours = hoursSince(thread.lastMessageAt, now);
    alerts.push({
      id: `sched_stall_${thread.id}`,
      type: "scheduling_stall",
      title: "Ready to schedule",
      description: `Client wants to meet — last message ${formatAge(hours)}`,
      threadId: thread.id,
      threadSubject: thread.subject,
      daysSinceLastAction: Math.floor(hours / 24),
      suggestedAction: "Send calendar link or propose times",
      urgency: hours >= 48 ? "high" : "medium",
    });
  }

  // ── Stale follow-up workflows ──
  const staleWorkflows = await db
    .select({
      workflow: followUpWorkflows,
      thread: emailThreads,
    })
    .from(followUpWorkflows)
    .innerJoin(emailThreads, eq(followUpWorkflows.threadId, emailThreads.id))
    .where(
      and(
        eq(followUpWorkflows.userId, user.userId),
        eq(followUpWorkflows.status, "active"),
        lt(followUpWorkflows.nextActionAt, now)
      )
    );

  for (const { workflow, thread } of staleWorkflows) {
    const hours = hoursSince(workflow.nextActionAt, now);
    alerts.push({
      id: `proposal_${workflow.id}`,
      type: "proposal_forgotten",
      title: "Proposal likely forgotten",
      description: `${workflow.workflowType?.replace(/_/g, " ")} — overdue ${formatAge(hours)}`,
      threadId: thread.id,
      threadSubject: thread.subject,
      daysSinceLastAction: Math.floor(hours / 24),
      suggestedAction: "Review and send follow-up",
      urgency: "high",
    });
  }

  // ── Client waiting for reply (any age including today) ──
  const clientWaiting = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.userId, user.userId),
        eq(emailThreads.businessCategory, "active_client"),
        eq(emailThreads.lastMessageDirection, "inbound"),
        ne(emailThreads.currentState, "hidden"),
        ne(emailThreads.currentState, "automated"),
        ne(emailThreads.currentState, "meeting_requested")
      )
    );

  for (const thread of clientWaiting) {
    const hours = hoursSince(thread.lastMessageAt, now);
    alerts.push({
      id: `client_wait_${thread.id}`,
      type: "client_waiting",
      title: "Client waiting",
      description: `Inbound message ${formatAge(hours)} — no reply`,
      threadId: thread.id,
      threadSubject: thread.subject,
      daysSinceLastAction: Math.floor(hours / 24),
      suggestedAction: "Draft a response",
      urgency: hours >= 72 ? "high" : hours >= 24 ? "medium" : "low",
    });
  }

  // ── Upsell windows: completed automations ready for next step ──
  const completedAutomations = await db
    .select()
    .from(emailThreads)
    .where(
      and(
        eq(emailThreads.userId, user.userId),
        eq(emailThreads.automationStatus, "completed")
      )
    );

  for (const thread of completedAutomations) {
    alerts.push({
      id: `upsell_${thread.id}`,
      type: "upsell_window",
      title: "Automation complete — ready for next step",
      description: `${thread.automationTurns} turns completed, client engaged`,
      threadId: thread.id,
      threadSubject: thread.subject,
      daysSinceLastAction: 0,
      suggestedAction: "Schedule a meeting or send proposal",
      urgency: "medium",
    });
  }

  // Deduplicate by threadId (keep highest urgency)
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  const seen = new Map<string, WatchtowerAlert>();
  for (const alert of alerts) {
    const existing = seen.get(alert.threadId);
    if (
      !existing ||
      urgencyOrder[alert.urgency] < urgencyOrder[existing.urgency]
    ) {
      seen.set(alert.threadId, alert);
    }
  }
  const deduped = Array.from(seen.values());

  deduped.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.daysSinceLastAction - a.daysSinceLastAction;
  });

  const enriched = await attachCounterpartyLabels(user.userId, deduped);

  const summary = {
    total: enriched.length,
    high: enriched.filter((a) => a.urgency === "high").length,
    recoverable: enriched.filter((a) =>
      ["lead_cooling", "lead_needs_reply", "proposal_forgotten", "scheduling_stall"].includes(
        a.type
      )
    ).length,
  };

  return NextResponse.json({ alerts: enriched, summary });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Watchtower error:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
