import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { browserTasks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  createBrowserTask,
  approveBrowserTask,
} from "@/lib/browser/browser-operator";

export async function GET() {
  try {
    const user = await requireApiUser();

    const tasks = await db
      .select()
      .from(browserTasks)
      .where(eq(browserTasks.userId, user.userId))
      .orderBy(desc(browserTasks.createdAt))
      .limit(20);

    return NextResponse.json({ tasks });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Browser GET error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
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
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Browser POST error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireApiUser();
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
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Browser PUT error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
