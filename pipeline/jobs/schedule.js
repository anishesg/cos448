import { config } from "../config.js";
import { getLeadsByState, updateLeadState, logEmail } from "../db.js";
import { findNextAvailableSlot, createMeetingEvent } from "../google/calendar.js";
import { sendEmail, sendSelfEmail } from "../google/gmail.js";
import { draftConfirmationEmail, draftSelfReminder } from "../llm/email-drafter.js";

/**
 * For each DETECTED lead: find a slot, create a calendar event with Meet link,
 * send confirmation email, send self-reminder, update state.
 */
export async function runSchedule(auth) {
  const leads = getLeadsByState("DETECTED");
  if (leads.length === 0) return;

  for (const lead of leads) {
    try {
      console.log(`[schedule] Scheduling meeting for ${lead.name}...`);

      // Find an available slot
      const slot = await findNextAvailableSlot(auth);
      if (!slot) {
        console.log(`[schedule] No available slot found for ${lead.name} in the next ${config.meeting.horizonDays} days`);
        continue;
      }

      // Create calendar event with Meet link
      const event = await createMeetingEvent(auth, {
        summary: `College Consulting - ${lead.name}`,
        description: `Consultation with ${lead.name}${lead.child_name ? ` (parent of ${lead.child_name})` : ""}.\n\nPhone: ${lead.phone || "N/A"}\nEmail: ${lead.email}`,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        attendeeEmails: [config.anishEmail, lead.email],
      });

      console.log(`[schedule] Created event: ${event.htmlLink}`);
      console.log(`[schedule] Meet link: ${event.meetLink}`);

      // Update lead with meeting info
      updateLeadState(lead.id, "SCHEDULED", {
        meeting_time: slot.startsAt,
        meet_link: event.meetLink,
        calendar_event_id: event.eventId,
        scheduled_at: new Date().toISOString(),
      });

      // Draft and send confirmation email to parent
      const confirmEmail = await draftConfirmationEmail({
        ...lead,
        meeting_time: slot.startsAt,
        meet_link: event.meetLink,
      });

      const confirmResult = await sendEmail(auth, {
        to: lead.email,
        subject: confirmEmail.subject,
        body: confirmEmail.body,
      });

      // Store thread ID for future replies
      updateLeadState(lead.id, "CONFIRMED", {
        gmail_thread_id: confirmResult.threadId,
        confirmed_at: new Date().toISOString(),
      });

      logEmail({
        leadId: lead.id,
        type: "confirmation",
        subject: confirmEmail.subject,
        body: confirmEmail.body,
        gmailMsgId: confirmResult.messageId,
      });

      console.log(`[schedule] Sent confirmation email to ${lead.email}`);

      // Send self-reminder to Anish
      const selfEmail = await draftSelfReminder({
        ...lead,
        meeting_time: slot.startsAt,
        meet_link: event.meetLink,
      });

      const selfResult = await sendSelfEmail(auth, {
        subject: selfEmail.subject,
        body: selfEmail.body,
      });

      logEmail({
        leadId: lead.id,
        type: "self_reminder",
        subject: selfEmail.subject,
        body: selfEmail.body,
        gmailMsgId: selfResult.messageId,
      });

      console.log(`[schedule] Sent self-reminder for ${lead.name}`);
    } catch (err) {
      console.error(`[schedule] Error scheduling ${lead.name}:`, err.message);
    }
  }
}
