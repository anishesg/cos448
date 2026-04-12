import { getLeadsForFollowup, updateLeadState, logEmail } from "../db.js";
import { sendEmail } from "../google/gmail.js";
import { draftFollowupEmail } from "../llm/email-drafter.js";

/**
 * Send follow-up emails for meetings that ended 2+ hours ago.
 */
export async function runFollowup(auth) {
  const leads = getLeadsForFollowup();
  if (leads.length === 0) return;

  for (const lead of leads) {
    try {
      console.log(`[followup] Sending follow-up for ${lead.name}...`);

      // Mark meeting as done first
      updateLeadState(lead.id, "MEETING_DONE", {
        meeting_done_at: new Date().toISOString(),
      });

      // Draft and send follow-up
      const email = await draftFollowupEmail({
        ...lead,
        meeting_time: lead.meeting_time,
        meet_link: lead.meet_link,
      });

      const result = await sendEmail(auth, {
        to: lead.email,
        subject: email.subject,
        body: email.body,
        threadId: lead.gmail_thread_id || undefined,
      });

      logEmail({
        leadId: lead.id,
        type: "followup",
        subject: email.subject,
        body: email.body,
        gmailMsgId: result.messageId,
      });

      updateLeadState(lead.id, "FOLLOWUP_SENT", {
        followup_at: new Date().toISOString(),
      });

      console.log(`[followup] Follow-up sent to ${lead.name} <${lead.email}>`);
    } catch (err) {
      console.error(`[followup] Error sending follow-up for ${lead.name}:`, err.message);
    }
  }
}
