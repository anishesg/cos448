/**
 * Linq Partner API service — single place for iMessage/SMS sends via Linq.
 * @see https://api.linqapp.com/api/partner/v3
 */

export const LINQ_DEFAULT_API_BASE = "https://api.linqapp.com/api/partner/v3";

/** Read env without throwing (for route validation / partial config). */
export function readLinqEnv(): {
  token: string | undefined;
  baseUrl: string;
  from?: string;
  defaultTo?: string;
} {
  return {
    token: process.env.LINQ_API_TOKEN?.trim(),
    baseUrl: (process.env.LINQ_API_BASE_URL?.trim() || LINQ_DEFAULT_API_BASE).replace(/\/$/, ""),
    from: process.env.LINQ_FROM_NUMBER?.trim(),
    defaultTo: process.env.LINQ_DEFAULT_TO_NUMBER?.trim(),
  };
}

export class LinqConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinqConfigError";
  }
}

export type CreateChatBody = {
  from: string;
  to: string[];
  message: { parts: Array<{ type: "text"; value: string }> };
};

export type LinqServiceConfig = {
  token: string;
  baseUrl: string;
  from?: string;
  defaultTo?: string;
};

/** Normalize US-heavy input to E.164 with leading + */
export function toE164(input: string): string {
  const t = input.trim();
  if (!t) return t;
  const digits = t.replace(/\D/g, "");
  if (t.startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export class LinqService {
  private readonly token: string;
  private readonly baseUrl: string;
  readonly defaultFrom?: string;
  readonly defaultTo?: string;

  constructor(config: LinqServiceConfig) {
    if (!config.token?.trim()) throw new LinqConfigError("LINQ_API_TOKEN is not set");
    this.token = config.token.trim();
    this.baseUrl = (config.baseUrl || LINQ_DEFAULT_API_BASE).replace(/\/$/, "");
    this.defaultFrom = config.from?.trim();
    this.defaultTo = config.defaultTo?.trim();
  }

  /** Build from `process.env` (Next / Lambda / local). */
  static fromEnv(): LinqService {
    const e = readLinqEnv();
    return new LinqService({
      token: e.token ?? "",
      baseUrl: e.baseUrl,
      from: e.from,
      defaultTo: e.defaultTo,
    });
  }

  getConfig(): { token: string; baseUrl: string; from?: string; defaultTo?: string } {
    return {
      token: this.token,
      baseUrl: this.baseUrl,
      from: this.defaultFrom,
      defaultTo: this.defaultTo,
    };
  }

  private async request(
    path: string,
    init: RequestInit & { parseJson?: boolean } = {}
  ): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const { parseJson = true, ...rest } = init;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.token}`,
      ...(rest.headers as Record<string, string> | undefined),
    };
    if (rest.body != null) headers["Content-Type"] = "application/json";

    const res = await fetch(url, { ...rest, headers });
    const text = await res.text();
    let json: unknown = null;
    if (parseJson && text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    return { ok: res.ok, status: res.status, json, text };
  }

  /** GET /v3/phone_numbers */
  async listPhoneNumbers() {
    return this.request("/phone_numbers", { method: "GET" });
  }

  /** POST /v3/chats — create chat + initial text */
  async createChat(body: CreateChatBody) {
    return this.request("/chats", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

let cached: LinqService | null = null;

/** Singleton for server handlers (env is static per process). */
export function getLinqService(): LinqService {
  if (!cached) cached = LinqService.fromEnv();
  return cached;
}

export function resetLinqServiceForTests() {
  cached = null;
}
