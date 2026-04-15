import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { followUpWorkflows, emailThreads } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { startFollowUpWorkflow } from "@/lib/workflows/follow-up-workflow";

export async function GET() {
  try {
    const user = await requireApiUser();

    const workflows = await db
      .select()
      .from(followUpWorkflows)
      .where(eq(followUpWorkflows.userId, user.userId))
      .orderBy(desc(followUpWorkflows.updatedAt));

    return NextResponse.json({ workflows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Workflows fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch workflows" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { threadId, workflowType, objective } = body;

    if (!threadId || !workflowType || !objective) {
      return NextResponse.json(
        { error: "threadId, workflowType, and objective are required" },
        { status: 400 }
      );
    }

    const ALLOWED_TYPES = ["gentle_nudge", "value_add", "closing", "re_engage"];
    if (!ALLOWED_TYPES.includes(workflowType)) {
      return NextResponse.json({ error: "Invalid workflow type" }, { status: 400 });
    }

    const [thread] = await db
      .select({ id: emailThreads.id })
      .from(emailThreads)
      .where(and(eq(emailThreads.id, threadId), eq(emailThreads.userId, user.userId)))
      .limit(1);

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const workflow = await startFollowUpWorkflow({
      userId: user.userId,
      threadId,
      workflowType,
      objective,
    });

    return NextResponse.json({ workflow });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Workflow creation error:", error);
    return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 });
  }
}
