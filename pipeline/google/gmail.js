import { google } from "googleapis";
import { config } from "../config.js";

function encodeBase64Url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildMimeMessage({ from, to, subject, body, threadId, inReplyTo }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const raw = headers.join("\r\n") + "\r\n\r\n" + body;
  return encodeBase64Url(raw);
}

async function retryRequest(fn, maxAttempts = 3) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.code || err.response?.status || 0;
      if (status === 429 || (status === 403 && /rate/i.test(err.message))) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** i));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Send an email via Gmail API.
 * Returns { messageId, threadId }
 */
export async function sendEmail(auth, { to, subject, body, threadId }) {
  const gmail = google.gmail({ version: "v1", auth });
  const raw = buildMimeMessage({
    from: config.anishEmail,
    to,
    subject,
    body,
    threadId,
  });

  const response = await retryRequest(() =>
    gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: threadId || undefined,
      },
    })
  );

  return {
    messageId: response.data.id,
    threadId: response.data.threadId,
  };
}

/**
 * Send an email to Anish himself (self-reminder).
 */
export async function sendSelfEmail(auth, { subject, body }) {
  return sendEmail(auth, {
    to: config.anishEmail,
    subject,
    body,
  });
}

/**
 * List recent emails (for reference / few-shot examples).
 */
export async function listRecentSentEmails(auth, maxResults = 10) {
  const gmail = google.gmail({ version: "v1", auth });
  const list = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    maxResults,
  });

  const messages = [];
  for (const msg of list.data.messages || []) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });
    messages.push(detail.data);
  }

  return messages;
}
