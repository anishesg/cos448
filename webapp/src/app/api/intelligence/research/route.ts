import { NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import {
  runResearchCycle,
  getRecentResearchChunks,
} from "@/lib/intelligence/research-runner";

export async function POST() {
  try {
    const user = await requireApiUser();
    const summary = await runResearchCycle(user.userId);
    return NextResponse.json(summary);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Research cycle POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const chunks = await getRecentResearchChunks(user.userId, 20);
    return NextResponse.json({ chunks });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Research cycle GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
