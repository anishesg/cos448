import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const systemPrompt = fs.readFileSync(
  path.join(__dirname, "..", "templates", "system-prompt.txt"),
  "utf8"
);

// Tiered model IDs (all cross-region us. prefix for API key auth)
const MODELS = {
  heavy: "us.anthropic.claude-opus-4-6-v1",               // complex tasks (follow-ups needing nuance)
  normal: "us.anthropic.claude-sonnet-4-6",                // standard tasks (confirmations, reminders)
  light: "us.anthropic.claude-haiku-4-5-20251001-v1:0",   // quick/simple tasks (1h reminder)
};

// Strict tool spec for structured email output
const emailTool = {
  name: "draft_email",
  description: "Output a drafted email with subject and body fields.",
  inputSchema: {
    json: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "The email subject line",
        },
        body: {
          type: "string",
          description: "The full email body text",
        },
      },
      required: ["subject", "body"],
      additionalProperties: false,
    },
  },
};

/**
 * Call Bedrock Converse API via raw HTTP with Bearer token auth.
 * Uses strict tool calling for structured { subject, body } output.
 *
 * @param {string} userPrompt
 * @param {"heavy"|"normal"|"light"} tier - model tier to use
 */
async function callBedrock(userPrompt, tier = "normal") {
  const token = config.bedrock.bearerToken;
  const region = config.bedrock.region;
  const modelId = MODELS[tier] || MODELS.normal;
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;

  const payload = {
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [{ text: userPrompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 1024,
      temperature: 0.7,
    },
    toolConfig: {
      tools: [{ toolSpec: emailTool }],
      toolChoice: {
        tool: { name: "draft_email" },
      },
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bedrock API error (${response.status}) [${modelId}]: ${text}`);
  }

  const data = await response.json();

  // Extract tool use result
  const toolUseBlock = data.output?.message?.content?.find(
    (block) => block.toolUse
  );

  if (toolUseBlock?.toolUse?.input) {
    const { subject, body } = toolUseBlock.toolUse.input;
    return { subject: subject || "College Consulting", body: body || "" };
  }

  // Fallback: parse text response
  const textBlock = data.output?.message?.content?.find(
    (block) => block.text
  );
  if (textBlock?.text) {
    const text = textBlock.text.trim();
    const subjectMatch = text.match(/^Subject:\s*(.+)/im);
    const subject = subjectMatch ? subjectMatch[1].trim() : "College Consulting";
    let body = subjectMatch
      ? text.slice(text.indexOf("\n", subjectMatch.index) + 1).trim()
      : text;
    body = body.replace(/^Body:\s*/i, "").trim();
    return { subject, body };
  }

  throw new Error("No usable output from Bedrock response");
}

function formatMeetingTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: config.timezone,
  });
}

function firstName(fullName) {
  return (fullName || "").split(/\s+/)[0] || "there";
}

// --- Normal tier: Sonnet 4.6 ---

export async function draftConfirmationEmail(lead) {
  const time = formatMeetingTime(lead.meeting_time);
  const child = lead.child_name ? ` about ${lead.child_name}'s` : " about your child's";

  return callBedrock(`
Draft a confirmation email to ${firstName(lead.name)} (full name: ${lead.name}).

Context: They signed up through a Google Form for a free 15-minute college consulting call with Anish. The meeting has been scheduled.

Meeting details:
- Time: ${time}
- Google Meet link: ${lead.meet_link}
- Duration: ${config.meeting.durationMinutes} minutes

${lead.child_name ? `Their child's name: ${lead.child_name}` : ""}
${lead.child_grade ? `Child's grade: ${lead.child_grade}` : ""}

The email should:
1. Thank them for signing up
2. Confirm the meeting time
3. Include the Google Meet link
4. Briefly mention you're excited to chat${child} college admissions journey
5. Keep it short and warm

You MUST call the draft_email tool with the subject and body.
  `, "normal");
}

export async function draftReminder24h(lead) {
  const time = formatMeetingTime(lead.meeting_time);

  return callBedrock(`
Draft a friendly 24-hour reminder email to ${firstName(lead.name)} (full name: ${lead.name}).

Context: They have a college consulting call with Anish scheduled for tomorrow.

Meeting details:
- Time: ${time}
- Google Meet link: ${lead.meet_link}

${lead.child_name ? `Their child's name: ${lead.child_name}` : ""}

The email should:
1. Be a quick, friendly nudge (2-3 sentences max in body)
2. Remind them of the time
3. Re-share the Meet link
4. Sound casual, not formal

You MUST call the draft_email tool with the subject and body.
  `, "normal");
}

// --- Light tier: Haiku 4.5 ---

export async function draftReminder1h(lead) {
  const time = formatMeetingTime(lead.meeting_time);

  return callBedrock(`
Draft a very brief 1-hour reminder email to ${firstName(lead.name)}.

Context: Their college consulting call with Anish is in about an hour.

Meeting link: ${lead.meet_link}
Time: ${time}

The email should be 1-2 sentences. Just a "see you soon" with the link. Very casual.

You MUST call the draft_email tool with the subject and body.
  `, "light");
}

// --- Heavy tier: Opus 4.6 ---

export async function draftFollowupEmail(lead) {
  return callBedrock(`
Draft a follow-up email to ${firstName(lead.name)} (full name: ${lead.name}) after their college consulting call with Anish.

Context: The call just happened. Anish provides 1:1 college consulting, meeting with students 2x/month, with ongoing email support. The rate is $200/month.

${lead.child_name ? `Their child's name: ${lead.child_name}` : ""}
${lead.child_grade ? `Child's grade: ${lead.child_grade}` : ""}

The email should:
1. Thank them for the call
2. Reference that you enjoyed learning about their situation (keep it generic since we don't know specifics)
3. Briefly recap what you offer (1:1 support, 2x monthly meetings, email support anytime)
4. Mention the next step if they want to move forward
5. Include the payment/signup link: https://tinyurl.com/anishconsulting
6. End warmly, no pressure

Keep it concise, 3-4 short paragraphs.

You MUST call the draft_email tool with the subject and body.
  `, "heavy");
}

// --- No LLM needed ---

export async function draftSelfReminder(lead) {
  const time = formatMeetingTime(lead.meeting_time);

  const subject = `Upcoming call: ${lead.name} - ${time}`;
  const body = `You have a consulting call coming up.

Who: ${lead.name}
Email: ${lead.email}
${lead.phone ? `Phone: ${lead.phone}` : ""}
${lead.child_name ? `Child: ${lead.child_name}` : ""}
${lead.child_grade ? `Grade: ${lead.child_grade}` : ""}

When: ${time}
Meet link: ${lead.meet_link}

Notes: ${lead.notes || "None yet"}`;

  return { subject, body };
}
