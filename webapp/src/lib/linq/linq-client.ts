/**
 * Linq iMessage API client
 * Docs: https://api.linqapp.com/api/partner
 *
 * Env vars required:
 *   LINQ_API_TOKEN   – Bearer token
 *   LINQ_FROM_NUMBER – The phone number to send from (must be registered in Linq)
 */

const BASE_URL = "https://api.linqapp.com/api/partner";

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
  return num;
}

// In-memory chat ID cache: phone → chatId
const chatCache = new Map<string, string>();

/** Create a new Linq chat with the given recipient and return its ID. */
async function createChat(to: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v3/chats`, {
    method: "POST",
    headers: linqHeaders(),
    body: JSON.stringify({ to, from: fromNumber() }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linq createChat failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { chat: { id: string } };
  return data.chat.id;
}

/**
 * Return an existing chatId for the given phone number, or create a new chat
 * and cache the result.
 */
export async function getOrCreateChat(to: string): Promise<string> {
  const cached = chatCache.get(to);
  if (cached) return cached;

  const chatId = await createChat(to);
  chatCache.set(to, chatId);
  return chatId;
}

/** Send an iMessage to a phone number. Creates the chat if needed. */
export async function sendImessage(to: string, message: string): Promise<void> {
  const chatId = await getOrCreateChat(to);

  const res = await fetch(`${BASE_URL}/v3/chats/${chatId}/messages`, {
    method: "POST",
    headers: linqHeaders(),
    body: JSON.stringify({
      parts: [{ type: "text", content: message }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // If the chat is stale (e.g. 404), evict cache and retry once with a fresh chat
    if (res.status === 404) {
      chatCache.delete(to);
      const freshId = await getOrCreateChat(to);
      const retry = await fetch(`${BASE_URL}/v3/chats/${freshId}/messages`, {
        method: "POST",
        headers: linqHeaders(),
        body: JSON.stringify({
          parts: [{ type: "text", content: message }],
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
  const res = await fetch(`${BASE_URL}/v3/webhooks`, {
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
  const res = await fetch(`${BASE_URL}/v3/phone_numbers`, {
    headers: linqHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linq listPhoneNumbers failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { phone_numbers: Array<{ number: string }> };
  return data.phone_numbers.map((p) => p.number);
}
