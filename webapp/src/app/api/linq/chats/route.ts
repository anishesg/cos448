import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { getLinqConfig, linqCreateChat, LinqConfigError, toE164 } from "@/lib/linq";

type Body = {
  to?: string[];
  message?: string;
  from?: string;
};

/**
 * POST — Create a Linq chat and send an initial text (same as Linq playground).
 * Body defaults: `from` / `to` from env; `message` defaults to a short test string.
 */
export async function POST(request: NextRequest) {
  try {
    await requireApiUser();
    const { token, from: envFrom, defaultTo } = getLinqConfig();
    if (!token) {
      return NextResponse.json(
        { error: "Linq is not configured: set LINQ_API_TOKEN" },
        { status: 503 }
      );
    }

    let body: Body = {};
    try {
      const t = await request.text();
      if (t) body = JSON.parse(t) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const from = toE164(body.from || envFrom || "");
    const rawTo = body.to?.length
      ? body.to
      : defaultTo
        ? [defaultTo]
        : [];
    const to = rawTo.map(toE164).filter(Boolean);
    const text = (body.message ?? "Hello from Friday (Linq test)").trim();

    if (!from) {
      return NextResponse.json(
        { error: "Missing from: set LINQ_FROM_NUMBER or pass from in body" },
        { status: 400 }
      );
    }
    if (to.length === 0) {
      return NextResponse.json(
        { error: "Missing to: set LINQ_DEFAULT_TO_NUMBER or pass to: [\"+1...\"] in body" },
        { status: 400 }
      );
    }

    const payload = {
      from,
      to,
      message: { parts: [{ type: "text" as const, value: text }] },
    };

    const result = await linqCreateChat(payload);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Linq API error", status: result.status, body: result.json ?? result.text },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 }
      );
    }
    return NextResponse.json({ ok: true, linq: result.json ?? result.text });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof LinqConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error("Linq chats:", e);
    return NextResponse.json({ error: "Linq request failed" }, { status: 500 });
  }
}
