/**
 * Proactive iMessage notification helpers.
 *
 * Call these from other parts of the app to push alerts to the owner.
 * Each notification is stored in a short in-memory ring buffer so the UI
 * can display a recent-notifications log.
 */

import { sendImessage } from "@/lib/linq/linq-client";

export interface NotificationRecord {
  id: string;
  type: string;
  message: string;
  sentAt: Date;
}

// In-memory ring buffer — last 50 notifications
const MAX_LOG = 50;
const notificationLog: NotificationRecord[] = [];

function ownerPhone(): string {
  const phone = process.env.LINQ_OWNER_PHONE;
  if (!phone) throw new Error("LINQ_OWNER_PHONE is not set");
  return phone;
}

function addToLog(type: string, message: string): void {
  notificationLog.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    sentAt: new Date(),
  });
  if (notificationLog.length > MAX_LOG) notificationLog.shift();
}

export function getNotificationLog(): NotificationRecord[] {
  return [...notificationLog].reverse();
}

// ─── Notification functions ──────────────────────────────────────────────────

export async function notifyNewHotLead(contact: {
  name: string;
  email: string;
  fitScore: number;
}): Promise<void> {
  const msg =
    `🔥 New hot lead: ${contact.name} (${contact.email})\n` +
    `Fit score: ${contact.fitScore}/100\n` +
    `Reply "hot leads" to see all leads.`;

  addToLog("hot_lead", msg);
  await sendImessage(ownerPhone(), msg);
}

export async function notifyUrgentThread(thread: {
  subject: string;
  id: string;
  sender: string;
}): Promise<void> {
  const msg =
    `⚡ Urgent thread needs reply\n` +
    `From: ${thread.sender}\n` +
    `Subject: ${thread.subject}\n` +
    `Thread ID: ${thread.id}\n` +
    `Reply "thread ${thread.id}" for details.`;

  addToLog("urgent_thread", msg);
  await sendImessage(ownerPhone(), msg);
}

export async function notifyDraftReady(thread: {
  subject: string;
  id: string;
  contactName: string;
}): Promise<void> {
  const msg =
    `✍️ Draft ready for review\n` +
    `To: ${thread.contactName}\n` +
    `Re: ${thread.subject}\n` +
    `Thread ID: ${thread.id}\n` +
    `Reply "thread ${thread.id}" to review, or "send ${thread.id}" to send.`;

  addToLog("draft_ready", msg);
  await sendImessage(ownerPhone(), msg);
}

export async function notifyEscalation(thread: {
  subject: string;
  id: string;
  reason: string;
}): Promise<void> {
  const msg =
    `🚨 Escalation flagged\n` +
    `Subject: ${thread.subject}\n` +
    `Reason: ${thread.reason}\n` +
    `Thread ID: ${thread.id}\n` +
    `Reply "thread ${thread.id}" for details.`;

  addToLog("escalation", msg);
  await sendImessage(ownerPhone(), msg);
}

export async function sendTestNotification(): Promise<void> {
  const msg =
    `✅ Linq iMessage connected!\n` +
    `You'll receive CRM alerts here.\n` +
    `Try replying: "status"`;

  addToLog("test", msg);
  await sendImessage(ownerPhone(), msg);
}
