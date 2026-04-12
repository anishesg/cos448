import { getLeadsForReminder, updateLeadState, logEmail } from "../db.js";
import { sendEmail, sendSelfEmail } from "../google/gmail.js";
import { draftReminder24h, draftReminder1h, draftSelfReminder } from "../llm/email-drafter.js";

/**
 * Check for leads that need 24h or 1h reminders and send them.
 */
export async function runRemind(auth) {
  // --- 24-hour reminders ---
  const leads24h = getLeadsForReminder("24h");
  for (const lead of leads24h) {
    try {
      console.log(`[remind] Sending 24h reminder for ${lead.name}...`);

      const email = await draftReminder24h({
        ...lead,
        meet_link: lead.meet_link,
        meeting_time: lead.meeting_time,
      });

      const result = await sendEmail(auth, {
        to: lead.email,
        subject: email.subject,
        body: email.body,
        threadId: lead.gmail_thread_id || undefined,
      });

      logEmail({
        leadId: lead.id,
        type: "reminder_24h",
        subject: email.subject,
        body: email.body,
        gmailMsgId: result.messageId,
      });

      // Self-reminder too
      const selfEmail = await draftSelfReminder({
        ...lead,
        meeting_time: lead.meeting_time,
        meet_link: lead.meet_link,
      });

      await sendSelfEmail(auth, {
        subject: `[Tomorrow] ${selfEmail.subject}`,
        body: selfEmail.body,
      });

      updateLeadState(lead.id, "REMINDED_24H", {
        reminded_24h_at: new Date().toISOString(),
      });

      console.log(`[remind] 24h reminder sent for ${lead.name}`);
    } catch (err) {
      console.error(`[remind] Error sending 24h reminder for ${lead.name}:`, err.message);
    }
  }

  // --- 1-hour reminders ---
  const leads1h = getLeadsForReminder("1h");
  for (const lead of leads1h) {
    try {
      console.log(`[remind] Sending 1h reminder for ${lead.name}...`);

      const email = await draftReminder1h({
        ...lead,
        meet_link: lead.meet_link,
        meeting_time: lead.meeting_time,
      });

      const result = await sendEmail(auth, {
        to: lead.email,
        subject: email.subject,
        body: email.body,
        threadId: lead.gmail_thread_id || undefined,
      });

      logEmail({
        leadId: lead.id,
        type: "reminder_1h",
        subject: email.subject,
        body: email.body,
        gmailMsgId: result.messageId,
      });

      // Quick self ping
      await sendSelfEmail(auth, {
        subject: `[In 1 hour] Call with ${lead.name}`,
        body: `Your call with ${lead.name} is in about an hour.\nMeet: ${lead.meet_link}`,
      });

      updateLeadState(lead.id, "REMINDED", {
        reminded_1h_at: new Date().toISOString(),
      });

      console.log(`[remind] 1h reminder sent for ${lead.name}`);
    } catch (err) {
      console.error(`[remind] Error sending 1h reminder for ${lead.name}:`, err.message);
    }
  }
}
