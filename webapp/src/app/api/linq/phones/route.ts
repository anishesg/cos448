import { NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { linqListPhoneNumbers, LinqConfigError, readLinqEnv } from "@/lib/linq";

/**
 * GET — List Linq numbers on your partner account (validates LINQ_API_TOKEN).
 */
export async function GET() {
  try {
    await requireApiUser();
    if (!readLinqEnv().token) {
      return NextResponse.json(
        { error: "Linq is not configured: set LINQ_API_TOKEN" },
        { status: 503 }
      );
    }
    const result = await linqListPhoneNumbers();
    return NextResponse.json(
      result.ok ? result.json ?? { raw: result.text } : { error: result.text, status: result.status },
      { status: result.ok ? 200 : result.status }
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof LinqConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error("Linq phones:", e);
    return NextResponse.json({ error: "Linq request failed" }, { status: 500 });
  }
}
