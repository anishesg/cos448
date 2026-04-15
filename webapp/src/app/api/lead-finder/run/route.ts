import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const maxDuration = 300;

const FB_OUTREACH_DIR = path.resolve(
  process.cwd(),
  "../../Lattice Research/fb_outreach"
);

interface RunState {
  status: "idle" | "running" | "done" | "error";
  logs: string[];
  startedAt: number | null;
}

// In-memory run state (persists across requests within the same process)
const runState: RunState = {
  status: "idle",
  logs: [],
  startedAt: null,
};

export async function GET() {
  return NextResponse.json(runState);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    platform?: string;
    query?: string;
  };

  // Already running — return current state
  if (runState.status === "running") {
    return NextResponse.json({ ok: true, alreadyRunning: true, state: runState });
  }

  runState.status = "running";
  runState.logs = [
    `[Lead Finder] Platform: ${body.platform ?? "Facebook"}`,
    `[Lead Finder] Query: ${body.query ?? "college admissions parents"}`,
    `[Lead Finder] Scanning group for recent posts...`,
  ];
  runState.startedAt = Date.now();

  // Run demo-flow.js in background (non-blocking)
  try {
    const child = spawn("node", ["demo-flow.js"], {
      cwd: FB_OUTREACH_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      runState.logs.push(...lines);
      if (runState.logs.length > 200) {
        runState.logs = runState.logs.slice(-200);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      runState.logs.push(...lines.map((l) => `[stderr] ${l}`));
    });

    child.on("close", (code) => {
      runState.status = code === 0 ? "done" : "error";
      runState.logs.push(
        `[Lead Finder] Process exited with code ${code}`
      );
    });

    child.on("error", (err) => {
      runState.status = "error";
      runState.logs.push(`[Lead Finder] Failed to start: ${err.message}`);
    });
  } catch (err) {
    runState.status = "error";
    runState.logs.push(
      `[Lead Finder] Spawn error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return NextResponse.json({ ok: true, state: runState });
}
