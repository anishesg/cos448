import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { followUpWorkflows } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { startFollowUpWorkflow } from "@/lib/workflows/follow-up-workflow";

export async function GET() {
  const user = await requireUser();

  const workflows = await db
    .select()
    .from(followUpWorkflows)
    .where(eq(followUpWorkflows.userId, user.userId))
    .orderBy(desc(followUpWorkflows.updatedAt));

  return NextResponse.json({ workflows });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json();

  const { threadId, workflowType, objective } = body;

  if (!threadId || !workflowType || !objective) {
    return NextResponse.json(
      { error: "threadId, workflowType, and objective are required" },
      { status: 400 }
    );
  }

  const workflow = await startFollowUpWorkflow({
    userId: user.userId,
    threadId,
    workflowType,
    objective,
  });

  return NextResponse.json({ workflow });
}
