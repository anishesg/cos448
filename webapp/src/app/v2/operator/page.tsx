"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Shield,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/v2/motion-wrapper";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";

interface BrowserTask {
  id: string;
  objective: string;
  tier: number;
  targetUrl: string | null;
  status: string;
  result: Record<string, unknown> | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  string,
  {
    icon: typeof Clock;
    color: string;
    badgeColor: "amber" | "cyan" | "purple" | "green" | "red" | "muted";
    label: string;
  }
> = {
  pending: {
    icon: Clock,
    color: "text-[#ffb800]",
    badgeColor: "amber",
    label: "Awaiting Approval",
  },
  approved: {
    icon: Play,
    color: "text-[#00d4ff]",
    badgeColor: "cyan",
    label: "Queued",
  },
  executing: {
    icon: Play,
    color: "text-[#a855f7]",
    badgeColor: "purple",
    label: "Running",
  },
  succeeded: {
    icon: CheckCircle2,
    color: "text-[#00e87b]",
    badgeColor: "green",
    label: "Succeeded",
  },
  failed: {
    icon: XCircle,
    color: "text-[#ff4060]",
    badgeColor: "red",
    label: "Failed",
  },
  cancelled: {
    icon: XCircle,
    color: "text-[var(--v2-text-tertiary)]",
    badgeColor: "muted",
    label: "Cancelled",
  },
};

const TIER_LABELS: Record<number, string> = {
  1: "Deterministic",
  2: "AI-Guided",
  3: "Full Agent",
};

const glassCard =
  "rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

function TaskCardV2({ task }: { task: BrowserTask }) {
  const qc = useQueryClient();
  const approveMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch("/api/browser", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "approve" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["browser-tasks"] }),
  });

  const config = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className={cn(glassCard, "p-4 space-y-3")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
            <span className="text-[14px] font-medium text-[var(--v2-text-primary)]">
              {task.objective}
            </span>
          </div>
          {task.targetUrl && (
            <p className="truncate text-[11px] text-[var(--v2-text-ghost)]">
              {task.targetUrl}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <V2Badge color="muted">
            T{task.tier}: {TIER_LABELS[task.tier]}
          </V2Badge>
          <V2Badge color={config.badgeColor} dot>
            {config.label}
          </V2Badge>
        </div>
      </div>

      {task.status === "executing" && (
        <div
          className={cn(
            glassCard,
            "overflow-hidden rounded-xl border-[rgba(168,85,247,0.15)] bg-[rgba(255,255,255,0.02)] p-3"
          )}
        >
          <div className="flex items-center gap-2 text-[12px] text-[#a855f7]">
            <div className="h-2 w-2 shrink-0 rounded-full bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.7)] animate-pulse" />
            Agent is navigating...
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[rgba(168,85,247,0.12)]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[#a855f7] to-[#00e87b]" />
          </div>
        </div>
      )}

      {task.result && task.status === "succeeded" && (
        <div className="rounded-xl border border-[rgba(0,232,123,0.15)] bg-[rgba(0,232,123,0.05)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
          <p className="text-[12px] text-[#00e87b]">
            Task completed successfully.
          </p>
        </div>
      )}
      {task.result && task.status === "failed" && (
        <div className="rounded-xl border border-[rgba(255,64,96,0.18)] bg-[rgba(255,64,96,0.06)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
          <p className="text-[12px] text-[#ff4060]">
            {(task.result as { error?: string }).error ?? "Task failed"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[10px] text-[var(--v2-text-ghost)]">
          {formatDistanceToNow(new Date(task.createdAt), {
            addSuffix: true,
          })}
        </span>
        {task.status === "pending" && (
          <div className="flex gap-2">
            <V2Button
              size="sm"
              color="green"
              onClick={() => approveMutation.mutate(task.id)}
              disabled={approveMutation.isPending}
            >
              <Shield className="h-3 w-3" />
              Approve
            </V2Button>
            <V2Button variant="ghost" size="sm" color="red">
              Reject
            </V2Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function V2OperatorPage() {
  const { data, isLoading } = useQuery<{ tasks: BrowserTask[] }>({
    queryKey: ["browser-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/browser");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  const tasks = data?.tasks ?? [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#a855f7] shadow-[0_0_24px_rgba(0,212,255,0.45)]">
            <Globe className="h-5 w-5 text-[var(--v2-bg-base)]" />
          </div>
          <h1 className="v2-text-gradient text-[24px] font-bold tracking-[-0.02em]">
            Browser Operator
          </h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <V2Skeleton
                key={i}
                className="h-28 w-full rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
              />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div
            className={cn(
              glassCard,
              "relative flex flex-col items-center justify-center overflow-hidden py-24 text-center"
            )}
          >
            <div className="pointer-events-none absolute -left-20 -top-16 h-60 w-60 rounded-full bg-[rgba(0,212,255,0.14)] blur-3xl" />
            <div className="pointer-events-none absolute -right-16 top-1/4 h-52 w-52 rounded-full bg-[rgba(168,85,247,0.12)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[rgba(0,232,123,0.08)] blur-3xl" />

            <div className="relative z-[1] flex flex-col items-center px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#a855f7] shadow-[0_0_36px_rgba(0,212,255,0.45)]">
                <Globe className="h-7 w-7 text-[var(--v2-bg-base)]" />
              </div>
              <p className="v2-text-gradient mt-5 text-[17px] font-semibold tracking-[-0.02em]">
                No browser tasks yet
              </p>
              <p className="mt-2 max-w-md text-[13px] text-[var(--v2-text-tertiary)]">
                The agent will create browser tasks when external actions are
                needed.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCardV2 key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
