import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { browserTasks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  createBrowserTask,
  approveBrowserTask,
} from "@/lib/browser/browser-operator";

export async function GET() {
  const user = await requireUser();

  const tasks = await db
    .select()
    .from(browserTasks)
    .where(eq(browserTasks.userId, user.userId))
    .orderBy(desc(browserTasks.createdAt))
    .limit(20);

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const { objective, targetUrl, threadId } = await request.json();

  if (!objective || !targetUrl) {
    return NextResponse.json(
      { error: "objective and targetUrl required" },
      { status: 400 }
    );
  }

  const task = await createBrowserTask({
    userId: user.userId,
    threadId,
    objective,
    targetUrl,
  });

  return NextResponse.json({ task });
}

export async function PUT(request: NextRequest) {
  const user = await requireUser();
  const { taskId, action } = await request.json();

  if (action === "approve") {
    const task = await approveBrowserTask(taskId);
    if (!task) {
      return NextResponse.json(
        { error: "Task not found or not pending" },
        { status: 404 }
      );
    }
    return NextResponse.json({ task });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
