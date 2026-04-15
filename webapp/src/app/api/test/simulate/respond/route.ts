import { NextRequest, NextResponse } from "next/server";
import { runSimulateRespondTurn } from "@/lib/test/simulate-respond-turn";

export const maxDuration = 120;

/**
 * Self-contained automation loop turn (no SES required).
 * 1) Generate customer AI reply and insert into Gmail + DB
 * 2) Generate our business reply and send via Gmail
 * 3) Schedule the next turn (if under limit)
 */
export async function POST(request: NextRequest) {
  const { threadId, userId } = await request.json();

  const result = await runSimulateRespondTurn(threadId, userId);

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}
