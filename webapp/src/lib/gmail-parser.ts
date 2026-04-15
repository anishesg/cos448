import { convert } from "html-to-text";
import type { gmail_v1 } from "googleapis";

type MessagePart = gmail_v1.Schema$MessagePart;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&#x2F;": "/",
  "&#47;": "/",
  "&nbsp;": " ",
};

export function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  let result = str.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 10))
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replaceAll(entity, char);
  }
  return result;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function findPart(
  part: MessagePart,
  mimeType: string
): MessagePart | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return part;
  }
  if (part.parts) {
    for (const child of part.parts) {
      const found = findPart(child, mimeType);
      if (found) return found;
    }
  }
  return null;
}

export function extractBody(payload: MessagePart | undefined): {
  plain: string | null;
  html: string | null;
} {
  if (!payload) return { plain: null, html: null };

  // Single-part message (no nested parts)
  if (!payload.parts && payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/plain") return { plain: decoded, html: null };
    if (payload.mimeType === "text/html") return { plain: null, html: decoded };
    return { plain: decoded, html: null };
  }

  // Multi-part: look for text/plain first, then text/html
  const plainPart = findPart(payload, "text/plain");
  const htmlPart = findPart(payload, "text/html");

  const plain = plainPart?.body?.data
    ? decodeBase64Url(plainPart.body.data)
    : null;
  const html = htmlPart?.body?.data
    ? decodeBase64Url(htmlPart.body.data)
    : null;

  return { plain, html };
}

export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
    ],
    preserveNewlines: true,
  });
}

export function getCleanBody(payload: MessagePart | undefined): string | null {
  const { plain, html } = extractBody(payload);
  if (plain) return plain.trim();
  if (html) return htmlToPlainText(html).trim();
  return null;
}

const QUOTED_REPLY_PATTERNS = [
  /^On .+ wrote:$/m,
  /^-{2,}\s*Original Message\s*-{2,}$/m,
  /^>{1,}\s/m,
  /^From:\s.+$/m,
  /^Sent:\s.+$/m,
];

export function trimQuotedReply(text: string): string {
  if (!text) return text;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of QUOTED_REPLY_PATTERNS) {
      if (pattern.test(lines[i])) {
        const trimmed = lines.slice(0, i).join("\n").trim();
        if (trimmed.length > 20) return trimmed;
      }
    }
  }
  return text;
}

export function getHeader(
  msg: gmail_v1.Schema$Message,
  name: string
): string | undefined {
  return (
    msg?.payload?.headers?.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase()
    )?.value ?? undefined
  );
}

export function parseSender(from: string): {
  name: string | null;
  email: string;
} {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    const raw = match[1].replace(/^["']|["']$/g, "").trim();
    const email = match[2].trim();
    if (raw && !raw.includes("@")) return { name: raw, email };
    return { name: nameFromEmail(email), email };
  }
  const email = from.trim().replace(/^["']|["']$/g, "");
  return { name: nameFromEmail(email), email };
}

function nameFromEmail(email: string): string | null {
  const local = email.split("@")[0];
  if (!local) return null;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length < 1) return null;
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}
