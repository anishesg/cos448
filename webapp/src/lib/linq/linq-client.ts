/**
 * Linq iMessage API client
 * Docs: https://api.linqapp.com/api/partner
 *
 * Env vars required:
 *   LINQ_API_TOKEN   – Bearer token
 *   LINQ_FROM_NUMBER – The phone number to send from (must be registered in Linq)
 */

const BASE_URL = "https://api.linqapp.com/api/partner/v3";

function linqHeaders(): HeadersInit {
  const token = process.env.LINQ_API_TOKEN;
  if (!token) throw new Error("LINQ_API_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function fromNumber(): string {
  const num = process.env.LINQ_FROM_NUMBER;
  if (!num) throw new Error("LINQ_FROM_NUMBER is not set");
  return num.trim();
}

/** Cache key: `${fromE164}:${toE164}` → chatId */
const chatCache = new Map<string, string>();

const PLACEHOLDER_INITIAL_TEXT = "\u2060";

function cacheKey(from: string, to: string): string {
  return `${from}:${to}`;
}

/** Create a new Linq chat with an initial message and return its ID (Partner v3). */
async function createChatWithInitialMessage(
  from: string,
  to: string,
  initialText: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/chats`, {
    method: "POST",
    headers: linqHeaders(),
    body: JSON.stringify({
      from,
      to: [to],
      message: {
        parts: [{ type: "text", value: initialText }],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linq createChat failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { chat?: { id?: string } };
  const id = data.chat?.id;
  if (!id) throw new Error("Linq createChat: missing chat.id in response");
  return id;
}

/**
 * Return an existing chatId for the given phone number, or create a new chat
 * and cache the result.
 */
export async function getOrCreateChat(to: string): Promise<string> {
  const from = fromNumber();
  const key = cacheKey(from, to);
  const cached = chatCache.get(key);
  if (cached) return cached;

  const chatId = await createChatWithInitialMessage(from, to, PLACEHOLDER_INITIAL_TEXT);
  chatCache.set(key, chatId);
  return chatId;
}

/** Send an iMessage to a phone number. Creates the chat if needed. */
export async function sendImessage(to: string, message: string): Promise<void> {
  const chatId = await getOrCreateChat(to);

  const res = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
    method: "POST",
    headers: linqHeaders(),
    body: JSON.stringify({
      message: {
        parts: [{ type: "text", value: message }],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // If the chat is stale (e.g. 404), evict cache and retry once with a fresh chat
    if (res.status === 404) {
      const from = fromNumber();
      chatCache.delete(cacheKey(from, to));
      const freshId = await getOrCreateChat(to);
      const retry = await fetch(`${BASE_URL}/chats/${freshId}/messages`, {
        method: "POST",
        headers: linqHeaders(),
        body: JSON.stringify({
          message: {
            parts: [{ type: "text", value: message }],
          },
        }),
      });
      if (!retry.ok) {
        const retryText = await retry.text();
        throw new Error(`Linq sendMessage retry failed (${retry.status}): ${retryText}`);
      }
      return;
    }
    throw new Error(`Linq sendMessage failed (${res.status}): ${text}`);
  }
}

/** Register a webhook URL with Linq for the message.received event. */
export async function registerWebhook(url: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/webhooks`, {
    method: "POST",
    headers: linqHeaders(),
    body: JSON.stringify({ url, events: ["message.received"] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linq registerWebhook failed (${res.status}): ${text}`);
  }
}

/** List available phone numbers on this Linq account. */
export async function listPhoneNumbers(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/phone_numbers`, {
    headers: linqHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linq listPhoneNumbers failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    phone_numbers?: Array<{ phone_number?: string; number?: string }>;
  };
  const rows = data.phone_numbers ?? [];
  return rows.map((p) => p.phone_number ?? p.number ?? "").filter(Boolean);
}
